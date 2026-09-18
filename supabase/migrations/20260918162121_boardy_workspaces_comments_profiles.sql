-- Boardy workspaces, collections, profiles, invitations, and pinned comments.
-- Cloud scenes remain the canonical whiteboard document and revision store.

create extension if not exists citext with schema extensions;

create table public.boardy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  email text not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boardy_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  sponsor_user_id uuid not null references auth.users(id) on delete restrict,
  subscription_status text not null default 'active'
    check (subscription_status in ('active', 'grace', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boardy_workspace_members (
  workspace_id uuid not null references public.boardy_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff', 'external')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (workspace_id, user_id)
);
create index boardy_workspace_members_user_idx
  on public.boardy_workspace_members(user_id, status, workspace_id);

create table public.boardy_subscription_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null check (reason in ('legacy_existing_user', 'support', 'test')),
  granted_at timestamptz not null default now()
);

-- Grandfather the complete Auth population at rollout time. This is intentionally
-- a one-time snapshot: users created after the migration still need a paid
-- entitlement or an invitation.
insert into public.boardy_subscription_allowlist (user_id, reason)
select id, 'legacy_existing_user' from auth.users
on conflict (user_id) do nothing;

create table public.boardy_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.boardy_workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  normalized_name text generated always as (lower(trim(name))) stored,
  visibility text not null default 'private'
    check (visibility in ('private', 'workspace', 'selected')),
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, normalized_name)
);
create index boardy_collections_workspace_idx
  on public.boardy_collections(workspace_id, status, updated_at desc);

create table public.boardy_collection_members (
  collection_id uuid not null references public.boardy_collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'commenter', 'viewer')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

alter table public.scenes
  add column workspace_id uuid references public.boardy_workspaces(id) on delete restrict,
  add column collection_id uuid references public.boardy_collections(id) on delete restrict,
  add column normalized_title text generated always as (lower(trim(title))) stored;

create unique index scenes_collection_title_unique_idx
  on public.scenes(collection_id, normalized_title)
  where status = 'active' and collection_id is not null;
create index scenes_workspace_collection_updated_idx
  on public.scenes(workspace_id, collection_id, status, updated_at desc);

alter table public.scene_members drop constraint if exists scene_members_role_check;
alter table public.scene_members
  add constraint scene_members_role_check
  check (role in ('owner', 'editor', 'commenter', 'viewer'));

create table public.boardy_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.boardy_workspaces(id) on delete cascade,
  collection_id uuid references public.boardy_collections(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  recipient_email text,
  workspace_role text check (workspace_role in ('staff', 'external')),
  resource_role text check (resource_role in ('editor', 'commenter', 'viewer')),
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(collection_id, scene_id) <= 1),
  check (workspace_role is not null or resource_role is not null)
);
create index boardy_invitations_workspace_idx
  on public.boardy_invitations(workspace_id, created_at desc);

create table public.boardy_invitation_redemptions (
  invitation_id uuid not null references public.boardy_invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (invitation_id, user_id)
);

create table public.boardy_comment_threads (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  thread_number bigint generated always as identity,
  created_by uuid not null references auth.users(id) on delete restrict,
  anchor_kind text not null check (anchor_kind in ('point', 'region', 'element', 'general')),
  anchor jsonb not null default '{}'::jsonb check (jsonb_typeof(anchor) = 'object'),
  version bigint not null default 1 check (version > 0),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scene_id, thread_number)
);
create index boardy_comment_threads_scene_activity_idx
  on public.boardy_comment_threads(scene_id, last_activity_at desc)
  where deleted_at is null;

create table public.boardy_comment_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.boardy_comment_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{16,100}$'),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (author_id, request_id)
);
create index boardy_comment_messages_thread_idx
  on public.boardy_comment_messages(thread_id, created_at, id);

create table public.boardy_comment_reactions (
  message_id uuid not null references public.boardy_comment_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.boardy_comment_mentions (
  message_id uuid not null references public.boardy_comment_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.boardy_comment_reads (
  thread_id uuid not null references public.boardy_comment_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_through timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table public.boardy_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  thread_id uuid references public.boardy_comment_threads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('mention', 'reply', 'access', 'role')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index boardy_notifications_user_idx
  on public.boardy_notifications(user_id, read_at, created_at desc);

create table public.boardy_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.boardy_workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index boardy_audit_workspace_idx
  on public.boardy_audit_events(workspace_id, id desc);

create or replace function public.boardy_redeem_invitation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invitation public.boardy_invitations%rowtype;
  actor_id uuid := auth.uid();
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  already_redeemed boolean;
begin
  if actor_id is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into invitation from public.boardy_invitations
    where token_hash = p_token_hash for update;
  if not found or invitation.revoked_at is not null
    or invitation.expires_at <= now()
    or (invitation.recipient_email is not null and lower(invitation.recipient_email) <> actor_email)
  then raise exception 'forbidden'; end if;

  select exists(select 1 from public.boardy_invitation_redemptions
    where invitation_id = invitation.id and user_id = actor_id) into already_redeemed;
  if not already_redeemed and invitation.use_count >= invitation.max_uses
  then raise exception 'forbidden'; end if;
  if not already_redeemed then
    insert into public.boardy_invitation_redemptions(invitation_id, user_id)
      values (invitation.id, actor_id);
    update public.boardy_invitations set use_count = use_count + 1 where id = invitation.id;
  end if;

  insert into public.boardy_workspace_members(workspace_id, user_id, role, status, removed_at)
    values (invitation.workspace_id, actor_id, coalesce(invitation.workspace_role, 'external'), 'active', null)
    on conflict (workspace_id, user_id) do update set status = 'active', removed_at = null;
  if invitation.collection_id is not null then
    insert into public.boardy_collection_members(collection_id, user_id, role, created_by)
      values (invitation.collection_id, actor_id, coalesce(invitation.resource_role, 'viewer'), invitation.created_by)
      on conflict (collection_id, user_id) do update set role = excluded.role;
  end if;
  if invitation.scene_id is not null then
    insert into public.scene_members(scene_id, user_id, role)
      values (invitation.scene_id, actor_id, coalesce(invitation.resource_role, 'viewer'))
      on conflict (scene_id, user_id) do update set role = excluded.role;
  end if;
  return jsonb_build_object('workspaceId', invitation.workspace_id, 'sceneId', invitation.scene_id, 'collectionId', invitation.collection_id);
end;
$$;

revoke all on function public.boardy_redeem_invitation(text) from public, anon;
grant execute on function public.boardy_redeem_invitation(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'boardy-avatars', 'boardy-avatars', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.workspace_role(target_workspace_id uuid, target_user_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.boardy_workspace_members
  where workspace_id = target_workspace_id and user_id = target_user_id and status = 'active'
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(private.workspace_role(target_workspace_id, target_user_id) = 'admin', false)
$$;

create or replace function private.collection_role(target_collection_id uuid, target_user_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when private.is_workspace_admin(c.workspace_id, target_user_id) then 'owner'
    when c.owner_id = target_user_id then 'owner'
    when c.visibility = 'workspace' and private.workspace_role(c.workspace_id, target_user_id) in ('admin', 'staff') then 'editor'
    else (select m.role from public.boardy_collection_members m
          where m.collection_id = c.id and m.user_id = target_user_id)
  end
  from public.boardy_collections c where c.id = target_collection_id and c.status = 'active'
$$;

create or replace function private.scene_effective_role(target_scene_id uuid, target_user_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  with roles(role) as (
    select case when private.is_workspace_admin(s.workspace_id, target_user_id) then 'owner' end
      from public.scenes s where s.id = target_scene_id
    union all
    select case when s.owner_id = target_user_id then 'owner' end
      from public.scenes s where s.id = target_scene_id
    union all
    select m.role from public.scene_members m
      where m.scene_id = target_scene_id and m.user_id = target_user_id
    union all
    select private.collection_role(s.collection_id, target_user_id)
      from public.scenes s where s.id = target_scene_id and s.collection_id is not null
  )
  select role from roles where role is not null
  order by case role when 'owner' then 4 when 'editor' then 3 when 'commenter' then 2 else 1 end desc
  limit 1
$$;

create or replace function private.can_read_scene(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.scene_effective_role(target_scene_id, target_user_id) is not null
$$;

create or replace function private.can_edit_scene(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.scene_effective_role(target_scene_id, target_user_id) in ('owner', 'editor')
$$;

create or replace function private.can_comment_scene(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.scene_effective_role(target_scene_id, target_user_id) in ('owner', 'editor', 'commenter')
$$;

create or replace function private.is_scene_owner(target_scene_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.scene_effective_role(target_scene_id, target_user_id) = 'owner'
$$;

create or replace function public.boardy_scene_capabilities(target_scene_id uuid)
returns jsonb language sql stable security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'role', private.scene_effective_role(target_scene_id, (select auth.uid())),
    'can_edit', private.can_edit_scene(target_scene_id, (select auth.uid())),
    'can_comment', private.can_comment_scene(target_scene_id, (select auth.uid())),
    'can_manage', private.is_scene_owner(target_scene_id, (select auth.uid()))
  )
  where private.can_read_scene(target_scene_id, (select auth.uid()))
$$;

create or replace function public.boardy_filter_scene_mentions(
  target_scene_id uuid,
  target_user_ids uuid[]
)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(candidate), '{}'::uuid[])
  from unnest(target_user_ids) candidate
  where private.can_read_scene(target_scene_id, candidate)
    and private.can_read_scene(target_scene_id, (select auth.uid()))
$$;

revoke all on function private.workspace_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.is_workspace_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function private.collection_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.scene_effective_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_comment_scene(uuid, uuid) from public, anon, authenticated;
grant execute on function private.workspace_role(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_workspace_admin(uuid, uuid) to authenticated, service_role;
grant execute on function private.collection_role(uuid, uuid) to authenticated, service_role;
grant execute on function private.scene_effective_role(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_comment_scene(uuid, uuid) to authenticated, service_role;
grant usage on schema private to authenticated, service_role;
revoke all on function public.boardy_scene_capabilities(uuid) from public, anon;
grant execute on function public.boardy_scene_capabilities(uuid) to authenticated;
revoke all on function public.boardy_filter_scene_mentions(uuid, uuid[]) from public, anon;
grant execute on function public.boardy_filter_scene_mentions(uuid, uuid[]) to authenticated;

alter table public.boardy_profiles enable row level security;
alter table public.boardy_workspaces enable row level security;
alter table public.boardy_workspace_members enable row level security;
alter table public.boardy_subscription_allowlist enable row level security;
alter table public.boardy_collections enable row level security;
alter table public.boardy_collection_members enable row level security;
alter table public.boardy_invitations enable row level security;
alter table public.boardy_invitation_redemptions enable row level security;
alter table public.boardy_comment_threads enable row level security;
alter table public.boardy_comment_messages enable row level security;
alter table public.boardy_comment_reactions enable row level security;
alter table public.boardy_comment_mentions enable row level security;
alter table public.boardy_comment_reads enable row level security;
alter table public.boardy_notifications enable row level security;
alter table public.boardy_audit_events enable row level security;

create policy "users can read authorized profiles" on public.boardy_profiles for select to authenticated
using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.boardy_workspace_members mine
    join public.boardy_workspace_members theirs using (workspace_id)
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and theirs.user_id = boardy_profiles.user_id and theirs.status = 'active'
      and mine.role in ('admin', 'staff')
  ) or exists (
    select 1 from public.scene_members mine
    join public.scene_members theirs using (scene_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = boardy_profiles.user_id
  ) or exists (
    select 1 from public.boardy_collection_members mine
    join public.boardy_collection_members theirs using (collection_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = boardy_profiles.user_id
  )
);
create policy "users update own profile" on public.boardy_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read workspaces" on public.boardy_workspaces for select to authenticated
using (private.workspace_role(id, (select auth.uid())) is not null);
create policy "members read memberships" on public.boardy_workspace_members for select to authenticated
using (
  user_id = (select auth.uid()) or
  private.workspace_role(workspace_id, (select auth.uid())) in ('admin', 'staff')
);
create policy "members read collections" on public.boardy_collections for select to authenticated
using (private.collection_role(id, (select auth.uid())) is not null);
create policy "members read collection grants" on public.boardy_collection_members for select to authenticated
using (private.collection_role(collection_id, (select auth.uid())) is not null);
create policy "admins read invitations" on public.boardy_invitations for select to authenticated
using (private.is_workspace_admin(workspace_id, (select auth.uid())));
create policy "users read own redemptions" on public.boardy_invitation_redemptions for select to authenticated
using (user_id = (select auth.uid()));

create policy "participants read comment threads" on public.boardy_comment_threads for select to authenticated
using (private.can_read_scene(scene_id, (select auth.uid())));
create policy "participants read comment messages" on public.boardy_comment_messages for select to authenticated
using (exists (select 1 from public.boardy_comment_threads t where t.id = thread_id and private.can_read_scene(t.scene_id, (select auth.uid()))));
create policy "participants read reactions" on public.boardy_comment_reactions for select to authenticated
using (exists (select 1 from public.boardy_comment_messages m join public.boardy_comment_threads t on t.id = m.thread_id where m.id = message_id and private.can_read_scene(t.scene_id, (select auth.uid()))));
create policy "participants read mentions" on public.boardy_comment_mentions for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.boardy_comment_messages m join public.boardy_comment_threads t on t.id = m.thread_id where m.id = message_id and private.can_read_scene(t.scene_id, (select auth.uid()))));
create policy "users read own comment state" on public.boardy_comment_reads for select to authenticated
using (user_id = (select auth.uid()));
create policy "users read notifications" on public.boardy_notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy "admins read workspace audit" on public.boardy_audit_events for select to authenticated
using (private.is_workspace_admin(workspace_id, (select auth.uid())));

create policy "users read own avatars" on storage.objects for select to authenticated
using (
  bucket_id = 'boardy-avatars' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or
    exists (select 1 from public.boardy_profiles p where p.avatar_path = name)
  )
);
create policy "users upload own avatars" on storage.objects for insert to authenticated
with check (bucket_id = 'boardy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users update own avatars" on storage.objects for update to authenticated
using (bucket_id = 'boardy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'boardy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete own avatars" on storage.objects for delete to authenticated
using (bucket_id = 'boardy-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on public.boardy_profiles, public.boardy_workspaces,
  public.boardy_workspace_members, public.boardy_subscription_allowlist,
  public.boardy_collections,
  public.boardy_collection_members, public.boardy_invitations,
  public.boardy_invitation_redemptions, public.boardy_comment_threads,
  public.boardy_comment_messages, public.boardy_comment_reactions,
  public.boardy_comment_mentions, public.boardy_comment_reads,
  public.boardy_notifications, public.boardy_audit_events from public, anon, authenticated;
grant select, update on public.boardy_profiles to authenticated;
grant select on public.boardy_workspaces, public.boardy_workspace_members,
  public.boardy_collections, public.boardy_collection_members,
  public.boardy_invitations, public.boardy_invitation_redemptions,
  public.boardy_comment_threads, public.boardy_comment_messages,
  public.boardy_comment_reactions, public.boardy_comment_mentions,
  public.boardy_comment_reads, public.boardy_notifications,
  public.boardy_audit_events to authenticated;
grant all on public.boardy_profiles, public.boardy_workspaces,
  public.boardy_workspace_members, public.boardy_subscription_allowlist,
  public.boardy_collections,
  public.boardy_collection_members, public.boardy_invitations,
  public.boardy_invitation_redemptions, public.boardy_comment_threads,
  public.boardy_comment_messages, public.boardy_comment_reactions,
  public.boardy_comment_mentions, public.boardy_comment_reads,
  public.boardy_notifications, public.boardy_audit_events to service_role;
grant usage, select on sequence public.boardy_comment_threads_thread_number_seq,
  public.boardy_audit_events_id_seq to service_role;

drop policy if exists "users can join a board from its private link" on public.board_members;
revoke insert on public.board_members from authenticated;

drop policy if exists "board members can receive private realtime events" on realtime.messages;
drop policy if exists "board members can send private realtime events" on realtime.messages;
create policy "scene participants receive private realtime events"
on realtime.messages for select to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'board'
  and split_part(realtime.topic(), ':', 3) = 'collaboration'
  and split_part(realtime.topic(), ':', 2) ~ '^[0-9a-f-]{36}$'
  and private.can_read_scene(split_part(realtime.topic(), ':', 2)::uuid, (select auth.uid()))
);
create policy "scene editors send private realtime events"
on realtime.messages for insert to authenticated
with check (
  split_part(realtime.topic(), ':', 1) = 'board'
  and split_part(realtime.topic(), ':', 3) = 'collaboration'
  and split_part(realtime.topic(), ':', 2) ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(split_part(realtime.topic(), ':', 2)::uuid, (select auth.uid()))
);
