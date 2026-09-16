create policy "members can delete encrypted board files"
on storage.objects
for delete
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
