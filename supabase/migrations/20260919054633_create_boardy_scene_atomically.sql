create or replace function public.boardy_create_scene(
  scene_title text,
  workspace_id uuid,
  collection_id uuid,
  blob_sha256 text,
  blob_storage_path text,
  blob_byte_size bigint,
  blob_uncompressed_byte_size bigint,
  actor_email text,
  request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  candidate_title text := coalesce(nullif(trim(scene_title), ''), 'Untitled whiteboard');
  base_title text := candidate_title;
  suffix integer := 2;
  created jsonb;
  created_scene_id uuid;
begin
  if actor is null then
    raise exception 'unauthenticated';
  end if;

  if not exists (
    select 1
    from public.boardy_workspace_members membership
    where membership.workspace_id = boardy_create_scene.workspace_id
      and membership.user_id = actor
      and membership.status = 'active'
      and membership.role in ('admin', 'staff')
  ) or not exists (
    select 1
    from public.boardy_collections collection
    where collection.id = boardy_create_scene.collection_id
      and collection.workspace_id = boardy_create_scene.workspace_id
      and collection.deleted_at is null
  ) then
    raise exception 'forbidden';
  end if;

  -- Serialize title allocation per collection so simultaneous creates cannot
  -- race the active-title uniqueness constraint.
  perform pg_advisory_xact_lock(hashtextextended(collection_id::text, 0));
  while exists (
    select 1
    from public.scenes scene
    where scene.collection_id = boardy_create_scene.collection_id
      and scene.status = 'active'
      and scene.normalized_title = lower(trim(candidate_title))
  ) loop
    candidate_title := base_title || ' ' || suffix;
    suffix := suffix + 1;
  end loop;

  created := public.cloud_create_scene(
    candidate_title,
    blob_sha256,
    blob_storage_path,
    blob_byte_size,
    blob_uncompressed_byte_size,
    actor_email,
    request_id
  );
  created_scene_id := (created ->> 'sceneId')::uuid;

  update public.scenes
  set workspace_id = boardy_create_scene.workspace_id,
      collection_id = boardy_create_scene.collection_id
  where id = created_scene_id
    and owner_id = actor;

  if not found then
    raise exception 'scene_assignment_failed';
  end if;

  return created || jsonb_build_object('title', candidate_title);
end;
$$;

revoke all on function public.boardy_create_scene(
  text, uuid, uuid, text, text, bigint, bigint, text, text
) from public, anon;
grant execute on function public.boardy_create_scene(
  text, uuid, uuid, text, text, bigint, bigint, text, text
) to authenticated;
