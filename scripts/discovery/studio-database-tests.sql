-- All fixtures roll back. Never delete or mutate real owner content permanently.
begin;
do $$
declare w uuid; j jsonb; a uuid; old_doc jsonb; n integer; got boolean:=false; v integer;
begin
 if exists(select 1 from pg_tables where schemaname='public' and tablename like 'boardy_studio_%' and not rowsecurity) then raise exception 'RLS missing'; end if;
 if has_table_privilege('authenticated','public.boardy_studio_articles','SELECT') or has_function_privilege('anon','public.boardy_studio_claim(uuid)','EXECUTE') then raise exception 'Private grants exposed'; end if;
 insert into public.boardy_studio_workers(token_hash) values('fixture-only-worker') returning id into w;
 update public.boardy_studio_settings set value=jsonb_build_object('model','fixture-model','paused',false);
 -- Keep weekly scheduling away from real prompts during this transaction.
 update public.boardy_studio_prompts set tracked=false;
 update public.boardy_studio_jobs set state='cancelled' where state in('queued','running');
 insert into public.boardy_studio_jobs(kind,input) values('research','{"model":"fixture-model","skillVersion":"fixture"}');
 j:=public.boardy_studio_claim(w);
 if j->>'state'<>'running' then raise exception 'Claim failed';end if;
 perform public.boardy_studio_finish(w,(j->>'id')::uuid,(j->>'lease_token')::uuid,'{"name":"fixture","body":"fixture"}');
 perform public.boardy_studio_finish(w,(j->>'id')::uuid,(j->>'lease_token')::uuid,'{"name":"fixture","body":"fixture"}');
 select count(*) into n from public.boardy_studio_knowledge where name='fixture';
 if n<>1 then raise exception 'Duplicate completion';end if;
 insert into public.boardy_studio_jobs(kind,input) values('research','{"model":"fixture-model"}');
 j:=public.boardy_studio_claim(w);
 update public.boardy_studio_jobs set lease_until=now()-interval '1 minute' where id=(j->>'id')::uuid;
 begin perform public.boardy_studio_finish(w,(j->>'id')::uuid,(j->>'lease_token')::uuid,'{}');exception when others then got:=true;end;
 if not got then raise exception 'Expired lease accepted';end if;
 perform public.boardy_studio_claim(w);
 if (select state from public.boardy_studio_jobs where id=(j->>'id')::uuid)<>'interrupted' then raise exception 'Recovery not explicit';end if;
 update public.boardy_studio_workers set revoked=true where id=w;
 got:=false;begin perform public.boardy_studio_claim(w);exception when others then got:=true;end;
 if not got then raise exception 'Revoked worker accepted';end if;
 old_doc:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Reviewed copy"}]}]}';
 insert into public.boardy_studio_articles(slug,title,doc) values('fixture-isolation','Fixture isolation',old_doc) returning id into a;
 perform public.boardy_studio_publish(jsonb_build_array(jsonb_build_object('id',a,'version',1)),true);
 if (select has_draft from public.boardy_studio_articles where id=a) then raise exception 'Published article still in review';end if;
 select version into v from public.boardy_studio_articles where id=a;
 update public.boardy_studio_articles set doc='{"type":"doc","content":[]}' where id=a;
 if not (select has_draft from public.boardy_studio_articles where id=a) then raise exception 'Changed draft missing from review';end if;
 if (select published->'doc' from public.boardy_studio_articles where id=a)<>old_doc then raise exception 'Draft leaked';end if;
 got:=false;begin perform public.boardy_studio_publish(jsonb_build_array(jsonb_build_object('id',a,'version',v)),true);exception when others then got:=true;end;
 if not got then raise exception 'Conflict ignored';end if;
 if not exists(select 1 from public.boardy_studio_revisions where entity_id=a and version=1) then raise exception 'Revision missing';end if;
 perform public.boardy_record_discovery('/learn/fixture-isolation','crawler','Fixture crawler');
 perform public.boardy_record_discovery('/learn/fixture-isolation.md','ai_referral','Fixture referral');
 if (public.boardy_studio_performance(array[a],7)->0->>'crawls')::integer<>1 or (public.boardy_studio_performance(array[a],7)->0->>'referrals')::integer<>1 then raise exception 'Article attribution incorrect';end if;
 raise notice 'PASS: RLS, grants, leases, recovery, revocation, duplicate completion, draft isolation, conflict, history';
end $$;
rollback;

select 'Studio transactional validation passed; fixtures rolled back' as result;
