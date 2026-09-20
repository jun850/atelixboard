create or replace function public.boardy_studio_claim(p_worker uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.boardy_studio_jobs; cfg jsonb;
begin
 perform id from public.boardy_studio_workers where id=p_worker and not revoked for update;
 if not found then raise exception 'WORKER_REVOKED'; end if;
 update public.boardy_studio_jobs set state='interrupted',error='Worker disconnected. Review before retrying.',finished_at=now() where state='running' and lease_until<now();
 if exists(select 1 from public.boardy_studio_jobs where worker_id=p_worker and state='running') then return null; end if;
 select value into cfg from public.boardy_studio_settings where id;
 if coalesce((cfg->>'paused')::boolean,false) or coalesce(cfg->>'model','')='' then return null; end if;
 -- Enqueue only a bounded due set, using a row lock to avoid duplicate weekly jobs.
 with due as (select id,text,version from public.boardy_studio_prompts p where tracked and not archived and next_check_at<=now()
 and not exists(select 1 from public.boardy_studio_jobs queued_job where queued_job.kind='check' and queued_job.state in ('queued','running') and queued_job.input->>'promptId'=p.id::text)
 order by next_check_at limit 20 for update skip locked), added as (
 insert into public.boardy_studio_jobs(kind,input) select 'check',jsonb_build_object('promptId',id,'prompt',text,'promptVersion',version,'model',cfg->>'model','skillVersion','1.0.0','search',true) from due returning input)
 update public.boardy_studio_prompts set next_check_at=now()+interval '7 days' where id in(select (input->>'promptId')::uuid from added);
 select * into j from public.boardy_studio_jobs where state='queued' order by (kind='check'),created_at limit 1 for update skip locked;
 if j.id is null then return null; end if;
 update public.boardy_studio_jobs set state='running',worker_id=p_worker,lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',started_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
