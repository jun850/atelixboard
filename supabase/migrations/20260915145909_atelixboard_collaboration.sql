create table public.board_members (
  room_id text not null check (room_id ~ '^[A-Za-z0-9_-]{10,64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.board_members enable row level security;

create policy "members can read their board memberships"
on public.board_members
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can join a board from its private link"
on public.board_members
for insert
to authenticated
with check ((select auth.uid()) = user_id);

grant select, insert on public.board_members to authenticated;

create table public.board_scenes (
  room_id text primary key check (room_id ~ '^[A-Za-z0-9_-]{10,64}$'),
  scene_version bigint not null default 0,
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);

alter table public.board_scenes enable row level security;

create policy "members can read encrypted board scenes"
on public.board_scenes
for select
to authenticated
using (
  exists (
    select 1
    from public.board_members
    where board_members.room_id = board_scenes.room_id
      and board_members.user_id = (select auth.uid())
  )
);

create policy "members can create encrypted board scenes"
on public.board_scenes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.board_members
    where board_members.room_id = board_scenes.room_id
      and board_members.user_id = (select auth.uid())
  )
);

create policy "members can update encrypted board scenes"
on public.board_scenes
for update
to authenticated
using (
  exists (
    select 1
    from public.board_members
    where board_members.room_id = board_scenes.room_id
      and board_members.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.board_members
    where board_members.room_id = board_scenes.room_id
      and board_members.user_id = (select auth.uid())
  )
);

grant select, insert, update on public.board_scenes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('board-files', 'board-files', false, 4194304)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy "members can read encrypted board files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'board-files'
  and exists (
    select 1
    from public.board_members
    where board_members.room_id = (storage.foldername(name))[1]
      and board_members.user_id = (select auth.uid())
  )
);

create policy "members can upload encrypted board files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'board-files'
  and exists (
    select 1
    from public.board_members
    where board_members.room_id = (storage.foldername(name))[1]
      and board_members.user_id = (select auth.uid())
  )
);

create policy "members can replace encrypted board files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'board-files'
  and exists (
    select 1
    from public.board_members
    where board_members.room_id = (storage.foldername(name))[1]
      and board_members.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'board-files'
  and exists (
    select 1
    from public.board_members
    where board_members.room_id = (storage.foldername(name))[1]
      and board_members.user_id = (select auth.uid())
  )
);

create policy "board members can receive private realtime events"
on realtime.messages
for select
to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'board'
  and split_part(realtime.topic(), ':', 3) = 'collaboration'
  and exists (
    select 1
    from public.board_members
    where board_members.room_id = split_part(realtime.topic(), ':', 2)
      and board_members.user_id = (select auth.uid())
  )
);

create policy "board members can send private realtime events"
on realtime.messages
for insert
to authenticated
with check (
  split_part(realtime.topic(), ':', 1) = 'board'
  and split_part(realtime.topic(), ':', 3) = 'collaboration'
  and exists (
    select 1
    from public.board_members
    where board_members.room_id = split_part(realtime.topic(), ':', 2)
      and board_members.user_id = (select auth.uid())
  )
);
