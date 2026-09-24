-- One manually created board and collection remain available without Pro.
alter table public.boardy_collections
  add column if not exists is_system_default boolean not null default false;

update public.boardy_collections collection
set is_system_default = true
from public.boardy_workspaces workspace
where collection.workspace_id = workspace.id
  and collection.owner_id = workspace.sponsor_user_id
  and collection.id = (
    select first_collection.id
    from public.boardy_collections first_collection
    where first_collection.workspace_id = workspace.id
      and first_collection.owner_id = workspace.sponsor_user_id
    order by first_collection.created_at, first_collection.id
    limit 1
  );

create table public.boardy_pro_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_until timestamptz not null
);
alter table public.boardy_pro_verifications enable row level security;
revoke all on public.boardy_pro_verifications from public, anon, authenticated;
grant all on public.boardy_pro_verifications to service_role;

create or replace function public.boardy_create_collection(
  p_workspace_id uuid,
  p_name text,
  p_visibility text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  created public.boardy_collections;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 91));
  if not exists (
    select 1 from public.boardy_workspace_members member
    where member.workspace_id = p_workspace_id and member.user_id = actor
      and member.status = 'active' and member.role in ('admin', 'staff')
  ) then raise exception 'forbidden'; end if;
  if trim(coalesce(p_name, '')) = '' or char_length(p_name) > 120 then
    raise exception 'limit';
  end if;
  if p_visibility not in ('private', 'workspace') then
    raise exception 'invalid_visibility';
  end if;
  if exists (
    select 1 from public.boardy_collections
    where owner_id = actor and not is_system_default
  ) and not exists (
    select 1 from public.boardy_pro_verifications
    where user_id = actor and verified_until > now()
  ) then raise exception 'pro_required'; end if;
  insert into public.boardy_collections(workspace_id, owner_id, name, visibility)
    values (p_workspace_id, actor, trim(p_name), p_visibility)
    returning * into created;
  return to_jsonb(created);
end;
$$;
revoke all on function public.boardy_create_collection(uuid, text, text) from public, anon;
grant execute on function public.boardy_create_collection(uuid, text, text) to authenticated;

create or replace function public.cloud_create_scene(
  scene_title text,
  blob_sha256 text,
  blob_storage_path text,
  blob_byte_size bigint,
  blob_uncompressed_byte_size bigint,
  actor_email text,
  request_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  new_scene public.scenes;
  blob public.scene_content_blobs;
  revision public.scene_revisions;
  cached jsonb;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 90));
  select response into cached from public.scene_command_receipts
    where user_id = actor and scene_command_receipts.request_id = cloud_create_scene.request_id;
  if cached is not null then return cached; end if;
  if exists (
    select 1 from public.scenes where owner_id = actor
  ) and not exists (
    select 1 from public.boardy_pro_verifications
    where user_id = actor and verified_until > now()
  ) then raise exception 'pro_required'; end if;
  insert into private.user_directory(user_id, email, updated_at) values (actor, actor_email, now())
    on conflict (user_id) do update set email = excluded.email, updated_at = excluded.updated_at;
  insert into public.scenes(owner_id, title) values (actor, coalesce(nullif(trim(scene_title), ''), 'Untitled scene')) returning * into new_scene;
  insert into public.scene_members(scene_id, user_id, role) values (new_scene.id, actor, 'owner');
  insert into public.scene_content_blobs(sha256, storage_path, byte_size, uncompressed_byte_size)
    values (blob_sha256, blob_storage_path, blob_byte_size, blob_uncompressed_byte_size)
    on conflict (sha256) do update set sha256 = excluded.sha256 returning * into blob;
  insert into public.scene_revisions(scene_id, revision_number, content_blob_id, created_by, change_kind)
    values (new_scene.id, 1, blob.id, actor, 'create') returning * into revision;
  update public.scenes set current_revision_id = revision.id, current_revision_number = 1 where id = new_scene.id;
  insert into public.scene_audit_events(scene_id, actor_id, action, revision_id, request_id)
    values (new_scene.id, actor, 'scene.create', revision.id, request_id);
  cached := jsonb_build_object('sceneId', new_scene.id, 'revisionId', revision.id, 'revisionNumber', 1);
  insert into public.scene_command_receipts(user_id, request_id, scene_id, command, response)
    values (actor, request_id, new_scene.id, 'scene.create', cached);
  return cached;
end;
$$;
