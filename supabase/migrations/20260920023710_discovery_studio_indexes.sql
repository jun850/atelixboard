create index boardy_studio_prompts_page on public.boardy_studio_prompts(created_at desc,id desc) where not archived;
create index boardy_studio_articles_page on public.boardy_studio_articles(created_at desc,id desc);
create index boardy_studio_knowledge_page on public.boardy_studio_knowledge(updated_at desc,id desc);
create index boardy_studio_jobs_page on public.boardy_studio_jobs(created_at desc,id desc);
create index boardy_studio_revisions_page on public.boardy_studio_revisions(entity_id,created_at desc,id desc);
create index boardy_studio_runs_page on public.boardy_studio_runs(created_at desc,id desc);
create index boardy_studio_runs_urls on public.boardy_studio_runs using gin(urls);

alter table public.boardy_studio_prompts add column evidence jsonb not null default '[]';
create or replace function public.boardy_studio_finish(p_worker uuid,p_job uuid,p_lease uuid,p_result jsonb,p_error text default null) returns void language plpgsql security invoker set search_path='' as $$
declare j public.boardy_studio_jobs; item jsonb;
begin
 perform id from public.boardy_studio_workers where id=p_worker and not revoked for update;
 if not found then raise exception 'WORKER_REVOKED'; end if;
 select * into j from public.boardy_studio_jobs where id=p_job for update;
 if j.state='completed' and j.worker_id=p_worker and j.lease_token=p_lease then return; end if;
 if j.id is null or j.state<>'running' or j.worker_id<>p_worker or j.lease_token<>p_lease or j.lease_until<now() then raise exception 'LEASE_LOST'; end if;
 if p_error is null then
  if j.kind='prompts' then
   for item in select * from jsonb_array_elements(p_result->'prompts') loop
    insert into public.boardy_studio_prompts(text,topic,persona,journey,sources,evidence) values(item->>'text',coalesce(item->>'topic',''),coalesce(item->>'persona',''),coalesce(item->>'journey',''),coalesce(item->'sources','[]'),coalesce(item->'evidence','[]')) on conflict do nothing;
   end loop;
  elsif j.kind='article' then
   insert into public.boardy_studio_articles(prompt_id,slug,title,description,format,doc) values((j.input->>'promptId')::uuid,p_result->>'slug',p_result->>'title',p_result->>'description',j.input->>'format',p_result->'doc');
  elsif j.kind='research' then
   insert into public.boardy_studio_knowledge(name,body,approved) values(p_result->>'name',p_result->>'body',false);
  elsif j.kind='check' then
   insert into public.boardy_studio_runs(job_id,prompt_id,prompt_version,prompt,model,answer,mentioned,urls,sources)
   values(j.id,(j.input->>'promptId')::uuid,(j.input->>'promptVersion')::integer,j.input->>'prompt',j.input->>'model',p_result->>'answer',(p_result->>'mentioned')::boolean,p_result->'urls',p_result->'sources');
  end if;
 end if;
 update public.boardy_studio_jobs set state=case when p_error is null then 'completed' else 'failed' end,result=p_result,error=p_error,finished_at=now() where id=p_job;
end $$;

