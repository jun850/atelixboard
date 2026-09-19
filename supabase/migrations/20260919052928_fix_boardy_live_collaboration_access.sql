-- Live collaboration now uses the cloud scene UUID as its room ID. The old
-- random-room policies depended on board_members, whose insert path is closed
-- for the current workspace/scene access model.

grant execute on function private.can_read_scene(uuid, uuid),
  private.can_edit_scene(uuid, uuid)
to authenticated, service_role;

drop policy if exists "members can read encrypted board scenes" on public.board_scenes;
drop policy if exists "members can create encrypted board scenes" on public.board_scenes;
drop policy if exists "members can update encrypted board scenes" on public.board_scenes;

create policy "scene participants can read encrypted board scenes"
on public.board_scenes
for select
to authenticated
using (
  room_id ~ '^[0-9a-f-]{36}$'
  and private.can_read_scene(room_id::uuid, (select auth.uid()))
);

create policy "scene editors can create encrypted board scenes"
on public.board_scenes
for insert
to authenticated
with check (
  room_id ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(room_id::uuid, (select auth.uid()))
);

create policy "scene editors can update encrypted board scenes"
on public.board_scenes
for update
to authenticated
using (
  room_id ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(room_id::uuid, (select auth.uid()))
)
with check (
  room_id ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(room_id::uuid, (select auth.uid()))
);

drop policy if exists "members can read encrypted board files" on storage.objects;
drop policy if exists "members can upload encrypted board files" on storage.objects;
drop policy if exists "members can replace encrypted board files" on storage.objects;

create policy "scene participants can read encrypted board files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'board-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and private.can_read_scene(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
);

create policy "scene editors can upload encrypted board files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'board-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
);

create policy "scene editors can replace encrypted board files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'board-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
)
with check (
  bucket_id = 'board-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and private.can_edit_scene(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
);
