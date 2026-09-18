create table public.board_documents (
  id uuid primary key default gen_random_uuid(),
  room_id text check (room_id is null or room_id ~ '^[A-Za-z0-9_-]{10,64}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  source_format text not null check (source_format in ('pdf', 'doc', 'docx')),
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index board_documents_owner_id_idx on public.board_documents(owner_id);
create index board_documents_room_id_idx on public.board_documents(room_id)
  where room_id is not null;

create table public.board_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.board_documents(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 240),
  file_format text not null check (file_format in ('pdf', 'doc', 'docx')),
  storage_path text not null unique,
  byte_size bigint not null check (byte_size between 1 and 52428800),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  revision_number integer not null check (revision_number > 0),
  created_at timestamptz not null default now(),
  unique (document_id, revision_number),
  unique (document_id, id)
);

alter table public.board_documents
  add constraint board_documents_current_revision_fk
  foreign key (id, current_revision_id)
  references public.board_document_revisions(document_id, id)
  deferrable initially deferred;

create index board_document_revisions_document_id_idx
  on public.board_document_revisions(document_id, revision_number desc);

create table public.board_document_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.board_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  editor_key text not null check (char_length(editor_key) between 16 and 160),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index board_document_sessions_expiry_idx
  on public.board_document_sessions(expires_at);

alter table public.board_documents enable row level security;
alter table public.board_document_revisions enable row level security;
alter table public.board_document_sessions enable row level security;

create policy "owners and board members can read documents"
on public.board_documents for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    room_id is not null
    and exists (
      select 1 from public.board_members
      where board_members.room_id = board_documents.room_id
        and board_members.user_id = (select auth.uid())
    )
  )
);

create policy "owners and board members can read document revisions"
on public.board_document_revisions for select to authenticated
using (
  exists (
    select 1 from public.board_documents
    where board_documents.id = board_document_revisions.document_id
      and (
        board_documents.owner_id = (select auth.uid())
        or (
          board_documents.room_id is not null
          and exists (
            select 1 from public.board_members
            where board_members.room_id = board_documents.room_id
              and board_members.user_id = (select auth.uid())
          )
        )
      )
  )
);

create policy "users can read their active document sessions"
on public.board_document_sessions for select to authenticated
using (user_id = (select auth.uid()) and expires_at > now());

revoke all on public.board_documents from anon, authenticated;
revoke all on public.board_document_revisions from anon, authenticated;
revoke all on public.board_document_sessions from anon, authenticated;
grant select on public.board_documents to authenticated;
grant select on public.board_document_revisions to authenticated;
grant select on public.board_document_sessions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-documents',
  'board-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Document bytes are brokered by authenticated Edge Functions so ONLYOFFICE
-- receives short-lived signed URLs and clients cannot replace immutable revisions.
-- No storage.objects policy is created for this bucket.
