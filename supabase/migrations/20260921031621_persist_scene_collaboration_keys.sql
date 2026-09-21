create table public.boardy_scene_collaboration_secrets (
  scene_id uuid primary key references public.scenes(id) on delete cascade,
  room_key text not null check (
    length(room_key) = 22
    and room_key ~ '^[A-Za-z0-9_-]{22}$'
  ),
  created_at timestamptz not null default now()
);

alter table public.boardy_scene_collaboration_secrets enable row level security;

revoke all on public.boardy_scene_collaboration_secrets
from public, anon, authenticated;
grant select, insert, update, delete
on public.boardy_scene_collaboration_secrets
to service_role;

create or replace function public.boardy_get_or_create_scene_collaboration_key(
  target_scene_id uuid,
  candidate_room_key text
)
returns table(room_key text, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  persisted_room_key text;
begin
  if target_scene_id is null
    or candidate_room_key is null
    or length(candidate_room_key) <> 22
    or candidate_room_key !~ '^[A-Za-z0-9_-]{22}$'
  then
    raise exception 'invalid_collaboration_key';
  end if;

  insert into public.boardy_scene_collaboration_secrets(scene_id, room_key)
  values (target_scene_id, candidate_room_key)
  on conflict (scene_id) do nothing
  returning boardy_scene_collaboration_secrets.room_key
  into persisted_room_key;

  if persisted_room_key is not null then
    -- Existing encrypted collaboration snapshots predate stable keys and
    -- cannot be decrypted with the newly persisted key. The ordinary cloud
    -- scene remains authoritative and is saved into a fresh snapshot next.
    delete from public.board_scenes
    where board_scenes.room_id = target_scene_id::text;

    return query select persisted_room_key, true;
    return;
  end if;

  select secret.room_key
  into persisted_room_key
  from public.boardy_scene_collaboration_secrets secret
  where secret.scene_id = target_scene_id;

  if persisted_room_key is null then
    raise exception 'collaboration_key_unavailable';
  end if;

  return query select persisted_room_key, false;
end;
$$;

revoke all on function public.boardy_get_or_create_scene_collaboration_key(uuid, text)
from public, anon, authenticated;
grant execute on function public.boardy_get_or_create_scene_collaboration_key(uuid, text)
to service_role;
