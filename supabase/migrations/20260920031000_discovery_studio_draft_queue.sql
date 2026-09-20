-- Published snapshots remain live while their next revision is reviewed.
alter table public.boardy_studio_articles add column has_draft boolean generated always as (
 published is null or doc is distinct from published->'doc'
 or title is distinct from published->>'title'
 or description is distinct from published->>'description'
) stored;
create index boardy_studio_draft_queue on public.boardy_studio_articles(created_at desc,id desc) where has_draft;
