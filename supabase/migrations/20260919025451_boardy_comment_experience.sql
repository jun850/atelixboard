-- Rich Boardy comments: private image attachments, explicit read state,
-- per-whiteboard notification preferences, private Realtime invalidation,
-- and a durable transactional-email outbox.

alter table public.boardy_comment_mentions
  add column display_text text
  check (display_text is null or char_length(display_text) between 2 and 121);

alter table public.boardy_comment_reads
  add column manual_unread boolean not null default false;

create table public.boardy_comment_attachments (
  message_id uuid primary key references public.boardy_comment_messages(id) on delete cascade,
  asset_id uuid not null unique references public.scene_assets(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.boardy_comment_notification_preferences (
  scene_id uuid not null references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'mentions_replies'
    check (mode in ('everything', 'mentions_replies', 'nothing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scene_id, user_id)
);
create index boardy_comment_preferences_user_idx
  on public.boardy_comment_notification_preferences(user_id, scene_id);

create table public.boardy_comment_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.boardy_notifications(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  thread_id uuid not null references public.boardy_comment_threads(id) on delete cascade,
  message_id uuid not null references public.boardy_comment_messages(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 12),
  available_at timestamptz not null default now(),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, recipient_user_id)
);
create index boardy_comment_email_outbox_queue_idx
  on public.boardy_comment_email_outbox(status, available_at, created_at)
  where status in ('pending', 'failed');

create table public.boardy_email_suppressions (
  email extensions.citext primary key,
  reason text not null check (reason in ('bounced', 'complained', 'suppressed')),
  provider_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.boardy_comment_attachments enable row level security;
alter table public.boardy_comment_notification_preferences enable row level security;
alter table public.boardy_comment_email_outbox enable row level security;
alter table public.boardy_email_suppressions enable row level security;

create policy "participants read comment attachments"
on public.boardy_comment_attachments for select to authenticated
using (
  exists (
    select 1
    from public.boardy_comment_messages m
    join public.boardy_comment_threads t on t.id = m.thread_id
    where m.id = message_id
      and private.can_read_scene(t.scene_id, (select auth.uid()))
  )
);

create policy "users read own comment preferences"
on public.boardy_comment_notification_preferences for select to authenticated
using (
  user_id = (select auth.uid())
  and private.can_read_scene(scene_id, (select auth.uid()))
);

-- Mutations stay brokered through Edge Functions. Explicit grants keep the
-- new tables compatible with projects that no longer auto-expose public tables.
revoke all on public.boardy_comment_attachments,
  public.boardy_comment_notification_preferences,
  public.boardy_comment_email_outbox,
  public.boardy_email_suppressions from public, anon, authenticated;
grant select on public.boardy_comment_attachments,
  public.boardy_comment_notification_preferences to authenticated;
grant all on public.boardy_comment_attachments,
  public.boardy_comment_notification_preferences,
  public.boardy_comment_email_outbox,
  public.boardy_email_suppressions to service_role;

create or replace function public.boardy_comment_recipient_ids(target_scene_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scene as (
    select s.id, s.owner_id, s.workspace_id, s.collection_id,
      c.owner_id as collection_owner_id, c.visibility
    from public.scenes s
    left join public.boardy_collections c on c.id = s.collection_id
    where s.id = target_scene_id and s.status = 'active'
  ), candidates(user_id) as (
    select owner_id from scene
    union
    select collection_owner_id from scene where collection_owner_id is not null
    union
    select sm.user_id from public.scene_members sm where sm.scene_id = target_scene_id
    union
    select cm.user_id
      from public.boardy_collection_members cm
      join scene s on s.collection_id = cm.collection_id
    union
    select wm.user_id
      from public.boardy_workspace_members wm
      join scene s on s.workspace_id = wm.workspace_id
      where wm.status = 'active'
        and (wm.role = 'admin' or (wm.role = 'staff' and s.visibility = 'workspace'))
  )
  select coalesce(array_agg(user_id order by user_id), '{}'::uuid[])
  from candidates
  where user_id is not null
    and private.can_read_scene(target_scene_id, user_id)
$$;
revoke all on function public.boardy_comment_recipient_ids(uuid) from public, anon, authenticated;
grant execute on function public.boardy_comment_recipient_ids(uuid) to service_role;

create or replace function private.broadcast_boardy_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime, pg_temp
as $$
declare
  target_scene_id uuid;
  target_thread_id uuid;
begin
  if tg_table_name = 'boardy_comment_threads' then
    target_scene_id := coalesce(new.scene_id, old.scene_id);
    target_thread_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'boardy_comment_messages' then
    target_thread_id := coalesce(new.thread_id, old.thread_id);
    select scene_id into target_scene_id
      from public.boardy_comment_threads where id = target_thread_id;
  elsif tg_table_name in ('boardy_comment_reactions', 'boardy_comment_attachments') then
    select t.scene_id, t.id into target_scene_id, target_thread_id
      from public.boardy_comment_messages m
      join public.boardy_comment_threads t on t.id = m.thread_id
      where m.id = coalesce(new.message_id, old.message_id);
  end if;

  if target_scene_id is not null then
    perform realtime.send(
      jsonb_build_object('threadId', target_thread_id),
      'comments-changed',
      'board:' || target_scene_id::text || ':comments',
      true
    );
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger boardy_comment_threads_broadcast
after insert or update or delete on public.boardy_comment_threads
for each row execute function private.broadcast_boardy_comment_change();
create trigger boardy_comment_messages_broadcast
after insert or update or delete on public.boardy_comment_messages
for each row execute function private.broadcast_boardy_comment_change();
create trigger boardy_comment_reactions_broadcast
after insert or update or delete on public.boardy_comment_reactions
for each row execute function private.broadcast_boardy_comment_change();
create trigger boardy_comment_attachments_broadcast
after insert or update or delete on public.boardy_comment_attachments
for each row execute function private.broadcast_boardy_comment_change();

drop policy if exists "scene participants receive private realtime events" on realtime.messages;
create policy "scene participants receive private realtime events"
on realtime.messages for select to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'board'
  and split_part(realtime.topic(), ':', 3) in ('collaboration', 'comments')
  and split_part(realtime.topic(), ':', 2) ~ '^[0-9a-f-]{36}$'
  and private.can_read_scene(
    split_part(realtime.topic(), ':', 2)::uuid,
    (select auth.uid())
  )
);
