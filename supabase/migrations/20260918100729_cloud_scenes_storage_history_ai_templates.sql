-- Boardy cloud scenes, immutable history, private assets, and assistant data.
-- Mutations are brokered through authenticated Edge Functions and RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.user_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  updated_at timestamptz not null default now()
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled scene' check (char_length(title) between 1 and 240),
  status text not null default 'active' check (status in ('active', 'deleted')),
  current_revision_id uuid,
  current_revision_number bigint not null default 0,
  thumbnail_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index scenes_owner_status_updated_idx
  on public.scenes(owner_id, status, updated_at desc);

create table public.scene_members (
  scene_id uuid not null references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (scene_id, user_id)
);
create index scene_members_user_idx on public.scene_members(user_id, scene_id);

create table public.scene_content_blobs (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  content_encoding text not null default 'gzip' check (content_encoding in ('identity', 'gzip')),
  media_type text not null default 'application/vnd.excalidraw+json',
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  uncompressed_byte_size bigint not null check (uncompressed_byte_size > 0 and uncompressed_byte_size <= 209715200),
  created_at timestamptz not null default now()
);

create table public.scene_revisions (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  revision_number bigint not null check (revision_number > 0),
  parent_revision_id uuid references public.scene_revisions(id) on delete restrict,
  restored_from_revision_id uuid references public.scene_revisions(id) on delete restrict,
  content_blob_id uuid not null references public.scene_content_blobs(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  change_kind text not null default 'edit' check (change_kind in ('create', 'edit', 'rename', 'restore', 'import', 'assistant', 'template')),
  change_summary text check (change_summary is null or char_length(change_summary) <= 500),
  element_count integer not null default 0 check (element_count >= 0),
  created_at timestamptz not null default now(),
  unique (scene_id, revision_number),
  unique (scene_id, id)
);
create index scene_revisions_scene_created_idx
  on public.scene_revisions(scene_id, revision_number desc);

alter table public.scenes
  add constraint scenes_current_revision_fk
  foreign key (id, current_revision_id)
  references public.scene_revisions(scene_id, id)
  deferrable initially deferred;

create table public.scene_assets (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind in ('upload', 'url', 'cdn', 'generated', 'document')),
  source_url text check (source_url is null or char_length(source_url) <= 4096),
  original_name text check (original_name is null or char_length(original_name) <= 512),
  media_type text not null check (char_length(media_type) between 1 and 255),
  byte_size bigint check (byte_size is null or byte_size between 1 and 524288000),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text unique,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed', 'deleted')),
  failure_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index scene_assets_scene_status_idx on public.scene_assets(scene_id, status, created_at);
create index scene_assets_sha_idx on public.scene_assets(sha256) where sha256 is not null;

alter table public.scenes
  add constraint scenes_thumbnail_asset_fk
  foreign key (thumbnail_asset_id) references public.scene_assets(id) on delete set null;

create table public.scene_asset_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.scene_assets(id) on delete cascade,
  variant_kind text not null check (variant_kind in ('thumbnail', 'preview', 'display', 'poster', 'original')),
  media_type text not null,
  storage_path text not null unique,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  unique (asset_id, variant_kind)
);

create table public.scene_revision_assets (
  revision_id uuid not null references public.scene_revisions(id) on delete cascade,
  asset_id uuid not null references public.scene_assets(id) on delete restrict,
  primary key (revision_id, asset_id)
);

create table public.scene_upload_intents (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  asset_id uuid not null unique references public.scene_assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  expected_byte_size bigint not null check (expected_byte_size between 1 and 524288000),
  expected_media_type text not null,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'expired', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index scene_upload_intents_expiry_idx on public.scene_upload_intents(expires_at);

create table public.scene_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  asset_id uuid references public.scene_assets(id) on delete cascade,
  job_kind text not null check (job_kind in ('import_url', 'inspect', 'image_variants', 'video_variants', 'document_preview', 'scene_thumbnail')),
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scene_processing_jobs_queue_idx
  on public.scene_processing_jobs(status, available_at) where status = 'queued';

create table public.scene_audit_events (
  id bigint generated always as identity primary key,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('scene.create', 'scene.update', 'scene.rename', 'scene.delete', 'scene.restore', 'revision.restore', 'member.add', 'member.update', 'member.remove', 'asset.add', 'asset.delete', 'assistant.apply', 'template.apply')),
  revision_id uuid references public.scene_revisions(id) on delete set null,
  request_id text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index scene_audit_events_scene_idx on public.scene_audit_events(scene_id, id desc);

create table public.scene_command_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  scene_id uuid references public.scenes(id) on delete cascade,
  command text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Assistant thread' check (char_length(title) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index ai_messages_thread_idx on public.ai_messages(thread_id, created_at);

create table public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  status text not null check (status in ('generated', 'applied', 'discarded', 'failed')),
  content jsonb not null,
  applied_revision_id uuid references public.scene_revisions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.personal_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 240),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'Custom' check (char_length(category) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'deleted')),
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.personal_template_revisions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.personal_templates(id) on delete cascade,
  revision_number bigint not null check (revision_number > 0),
  content_blob_id uuid not null references public.scene_content_blobs(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, revision_number),
  unique (template_id, id)
);

alter table public.personal_templates
  add constraint personal_templates_current_revision_fk
  foreign key (id, current_revision_id)
  references public.personal_template_revisions(template_id, id)
  deferrable initially deferred;

create table public.personal_template_assets (
  template_revision_id uuid not null references public.personal_template_revisions(id) on delete cascade,
  asset_id uuid not null references public.scene_assets(id) on delete restrict,
  primary key (template_revision_id, asset_id)
);

create or replace function private.can_read_scene(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scenes s
    where s.id = target_scene_id
      and (s.owner_id = target_user_id or exists (
        select 1 from public.scene_members m
        where m.scene_id = s.id and m.user_id = target_user_id
      ))
  );
$$;

create or replace function private.can_edit_scene(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.scenes s
    where s.id = target_scene_id and s.status = 'active'
      and (s.owner_id = target_user_id or exists (
        select 1 from public.scene_members m
        where m.scene_id = s.id and m.user_id = target_user_id and m.role in ('owner', 'editor')
      ))
  );
$$;

create or replace function private.is_scene_owner(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.scenes where id = target_scene_id and owner_id = target_user_id);
$$;

revoke all on function private.can_read_scene(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_edit_scene(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_scene_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_read_scene(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_edit_scene(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_scene_owner(uuid, uuid) to authenticated, service_role;

alter table public.scenes enable row level security;
alter table public.scene_members enable row level security;
alter table public.scene_content_blobs enable row level security;
alter table public.scene_revisions enable row level security;
alter table public.scene_assets enable row level security;
alter table public.scene_asset_variants enable row level security;
alter table public.scene_revision_assets enable row level security;
alter table public.scene_upload_intents enable row level security;
alter table public.scene_processing_jobs enable row level security;
alter table public.scene_audit_events enable row level security;
alter table public.scene_command_receipts enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_drafts enable row level security;
alter table public.personal_templates enable row level security;
alter table public.personal_template_revisions enable row level security;
alter table public.personal_template_assets enable row level security;

create policy "scene participants can read scenes" on public.scenes for select to authenticated
  using (private.can_read_scene(id, (select auth.uid())));
create policy "users can create owned scenes" on public.scenes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "editors can update scenes" on public.scenes for update to authenticated
  using (private.can_edit_scene(id, (select auth.uid())) or private.is_scene_owner(id, (select auth.uid())))
  with check (private.can_read_scene(id, (select auth.uid())));

create policy "scene participants can read members" on public.scene_members for select to authenticated
  using (private.can_read_scene(scene_id, (select auth.uid())));

create policy "scene participants can read revisions" on public.scene_revisions for select to authenticated
  using (private.can_read_scene(scene_id, (select auth.uid())));
create policy "scene participants can read referenced blobs" on public.scene_content_blobs for select to authenticated
  using (exists (
    select 1 from public.scene_revisions r
    where r.content_blob_id = scene_content_blobs.id
      and private.can_read_scene(r.scene_id, (select auth.uid()))
  ) or exists (
    select 1 from public.personal_template_revisions tr
    join public.personal_templates t on t.id = tr.template_id
    where tr.content_blob_id = scene_content_blobs.id and t.owner_id = (select auth.uid())
  ));

create policy "scene participants can read assets" on public.scene_assets for select to authenticated
  using (private.can_read_scene(scene_id, (select auth.uid())));
create policy "scene participants can read asset variants" on public.scene_asset_variants for select to authenticated
  using (exists (select 1 from public.scene_assets a where a.id = asset_id and private.can_read_scene(a.scene_id, (select auth.uid()))));
create policy "scene participants can read revision assets" on public.scene_revision_assets for select to authenticated
  using (exists (select 1 from public.scene_revisions r where r.id = revision_id and private.can_read_scene(r.scene_id, (select auth.uid()))));

create policy "users can read their upload intents" on public.scene_upload_intents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners can read audit" on public.scene_audit_events for select to authenticated
  using (private.is_scene_owner(scene_id, (select auth.uid())));
create policy "users can read command receipts" on public.scene_command_receipts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "thread owners can read threads" on public.ai_threads for select to authenticated
  using (user_id = (select auth.uid()) and private.can_read_scene(scene_id, (select auth.uid())));
create policy "thread owners can read messages" on public.ai_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "draft owners can read drafts" on public.ai_drafts for select to authenticated
  using (created_by = (select auth.uid()));

create policy "owners can read templates" on public.personal_templates for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "owners can read template revisions" on public.personal_template_revisions for select to authenticated
  using (exists (select 1 from public.personal_templates t where t.id = template_id and t.owner_id = (select auth.uid())));
create policy "owners can read template assets" on public.personal_template_assets for select to authenticated
  using (exists (
    select 1 from public.personal_template_revisions tr
    join public.personal_templates t on t.id = tr.template_id
    where tr.id = template_revision_id and t.owner_id = (select auth.uid())
  ));

revoke all on public.scenes, public.scene_members, public.scene_content_blobs,
  public.scene_revisions, public.scene_assets, public.scene_asset_variants,
  public.scene_revision_assets, public.scene_upload_intents,
  public.scene_processing_jobs, public.scene_audit_events,
  public.scene_command_receipts, public.ai_threads, public.ai_messages,
  public.ai_drafts, public.personal_templates,
  public.personal_template_revisions, public.personal_template_assets
  from anon, authenticated;

grant select on public.scenes, public.scene_members, public.scene_content_blobs,
  public.scene_revisions, public.scene_assets, public.scene_asset_variants,
  public.scene_revision_assets, public.scene_upload_intents,
  public.scene_audit_events, public.scene_command_receipts,
  public.ai_threads, public.ai_messages, public.ai_drafts,
  public.personal_templates, public.personal_template_revisions,
  public.personal_template_assets to authenticated;
grant all on public.scenes, public.scene_members, public.scene_content_blobs,
  public.scene_revisions, public.scene_assets, public.scene_asset_variants,
  public.scene_revision_assets, public.scene_upload_intents,
  public.scene_processing_jobs, public.scene_audit_events,
  public.scene_command_receipts, public.ai_threads, public.ai_messages,
  public.ai_drafts, public.personal_templates,
  public.personal_template_revisions, public.personal_template_assets
  to service_role;
grant usage, select on sequence public.scene_audit_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('scene-content', 'scene-content', false, 52428800),
  ('scene-assets', 'scene-assets', false, 524288000),
  ('scene-staging', 'scene-staging', false, 524288000)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy "scene participants can read cloud objects" on storage.objects for select to authenticated
using (
  bucket_id in ('scene-content', 'scene-assets')
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and private.can_read_scene(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

create policy "editors can upload staged scene objects" on storage.objects for insert to authenticated
with check (
  bucket_id = 'scene-staging'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

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
  select response into cached from public.scene_command_receipts where user_id = actor and scene_command_receipts.request_id = cloud_create_scene.request_id;
  if cached is not null then return cached; end if;
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

create or replace function public.cloud_commit_scene_revision(
  target_scene_id uuid,
  expected_revision_number bigint,
  blob_sha256 text,
  blob_storage_path text,
  blob_byte_size bigint,
  blob_uncompressed_byte_size bigint,
  actor_email text,
  request_id text,
  change_kind text default 'edit',
  change_summary text default null,
  element_count integer default 0,
  asset_ids uuid[] default '{}'::uuid[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.scenes;
  blob public.scene_content_blobs;
  revision public.scene_revisions;
  cached jsonb;
begin
  if actor is null or not private.can_edit_scene(target_scene_id, actor) then raise exception 'forbidden'; end if;
  select response into cached from public.scene_command_receipts where user_id = actor and scene_command_receipts.request_id = cloud_commit_scene_revision.request_id;
  if cached is not null then return cached; end if;
  select * into target from public.scenes where id = target_scene_id for update;
  if target.current_revision_number <> expected_revision_number then raise exception 'revision_conflict'; end if;
  insert into private.user_directory(user_id, email, updated_at) values (actor, actor_email, now())
    on conflict (user_id) do update set email = excluded.email, updated_at = excluded.updated_at;
  insert into public.scene_content_blobs(sha256, storage_path, byte_size, uncompressed_byte_size)
    values (blob_sha256, blob_storage_path, blob_byte_size, blob_uncompressed_byte_size)
    on conflict (sha256) do update set sha256 = excluded.sha256 returning * into blob;
  insert into public.scene_revisions(scene_id, revision_number, parent_revision_id, content_blob_id, created_by, change_kind, change_summary, element_count)
    values (target.id, target.current_revision_number + 1, target.current_revision_id, blob.id, actor, change_kind, change_summary, element_count)
    returning * into revision;
  insert into public.scene_revision_assets(revision_id, asset_id)
    select revision.id, a.id from public.scene_assets a where a.scene_id = target.id and a.id = any(asset_ids)
    on conflict do nothing;
  update public.scenes set current_revision_id = revision.id, current_revision_number = revision.revision_number, updated_at = now() where id = target.id;
  insert into public.scene_audit_events(scene_id, actor_id, action, revision_id, request_id, details)
    values (target.id, actor, case when change_kind = 'assistant' then 'assistant.apply' else 'scene.update' end, revision.id, request_id, jsonb_build_object('summary', change_summary));
  cached := jsonb_build_object('sceneId', target.id, 'revisionId', revision.id, 'revisionNumber', revision.revision_number);
  insert into public.scene_command_receipts(user_id, request_id, scene_id, command, response)
    values (actor, request_id, target.id, 'scene.commit', cached);
  return cached;
end;
$$;

create or replace function public.cloud_restore_scene_revision(
  target_scene_id uuid,
  source_revision_id uuid,
  actor_email text,
  request_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); target public.scenes; source public.scene_revisions; revision public.scene_revisions; cached jsonb;
begin
  if actor is null or not private.is_scene_owner(target_scene_id, actor) then raise exception 'forbidden'; end if;
  select response into cached from public.scene_command_receipts where user_id = actor and scene_command_receipts.request_id = cloud_restore_scene_revision.request_id;
  if cached is not null then return cached; end if;
  select * into target from public.scenes where id = target_scene_id for update;
  select * into source from public.scene_revisions where id = source_revision_id and scene_id = target_scene_id;
  if source.id is null then raise exception 'revision_not_found'; end if;
  insert into private.user_directory(user_id, email, updated_at) values (actor, actor_email, now()) on conflict (user_id) do update set email = excluded.email, updated_at = excluded.updated_at;
  insert into public.scene_revisions(scene_id, revision_number, parent_revision_id, restored_from_revision_id, content_blob_id, created_by, change_kind, change_summary, element_count)
    values (target.id, target.current_revision_number + 1, target.current_revision_id, source.id, source.content_blob_id, actor, 'restore', 'Restored revision ' || source.revision_number, source.element_count)
    returning * into revision;
  insert into public.scene_revision_assets(revision_id, asset_id) select revision.id, asset_id from public.scene_revision_assets where revision_id = source.id;
  update public.scenes set current_revision_id = revision.id, current_revision_number = revision.revision_number, status = 'active', deleted_at = null, updated_at = now() where id = target.id;
  insert into public.scene_audit_events(scene_id, actor_id, action, revision_id, request_id, details)
    values (target.id, actor, 'revision.restore', revision.id, request_id, jsonb_build_object('sourceRevisionId', source.id));
  cached := jsonb_build_object('sceneId', target.id, 'revisionId', revision.id, 'revisionNumber', revision.revision_number);
  insert into public.scene_command_receipts(user_id, request_id, scene_id, command, response) values (actor, request_id, target.id, 'revision.restore', cached);
  return cached;
end;
$$;

create or replace function public.cloud_scene_history(target_scene_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null or not private.is_scene_owner(target_scene_id, actor) then
    raise exception 'forbidden';
  end if;
  select jsonb_build_object(
    'revisions', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.revision_number desc)
      from (
        select id, revision_number, parent_revision_id,
          restored_from_revision_id, created_by, change_kind,
          change_summary, element_count, created_at
        from public.scene_revisions
        where scene_id = target_scene_id
        order by revision_number desc limit 200
      ) r
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.id desc)
      from (
        select id, actor_id, action, revision_id, request_id, details, created_at
        from public.scene_audit_events
        where scene_id = target_scene_id
        order by id desc limit 500
      ) e
    ), '[]'::jsonb),
    'actors', coalesce((
      select jsonb_object_agg(d.user_id::text, d.email)
      from private.user_directory d
      where d.user_id in (
        select created_by from public.scene_revisions where scene_id = target_scene_id
        union
        select actor_id from public.scene_audit_events where scene_id = target_scene_id
      )
    ), '{}'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.cloud_create_scene(text, text, text, bigint, bigint, text, text) from public, anon;
revoke all on function public.cloud_commit_scene_revision(uuid, bigint, text, text, bigint, bigint, text, text, text, text, integer, uuid[]) from public, anon;
revoke all on function public.cloud_restore_scene_revision(uuid, uuid, text, text) from public, anon;
revoke all on function public.cloud_scene_history(uuid) from public, anon;
grant execute on function public.cloud_create_scene(text, text, text, bigint, bigint, text, text) to authenticated;
grant execute on function public.cloud_commit_scene_revision(uuid, bigint, text, text, bigint, bigint, text, text, text, text, integer, uuid[]) to authenticated;
grant execute on function public.cloud_restore_scene_revision(uuid, uuid, text, text) to authenticated;
grant execute on function public.cloud_scene_history(uuid) to authenticated;
