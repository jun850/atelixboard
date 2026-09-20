begin;
do $$
declare before_count bigint; after_count bigint;
begin
  if has_table_privilege('anon','public.boardy_discovery_daily','select') or has_table_privilege('authenticated','public.boardy_discovery_daily','select') or has_table_privilege('authenticated','public.boardy_discovery_checks','select') then raise exception 'Private table access granted'; end if;
  if has_function_privilege('anon','public.boardy_record_discovery(text,text,text)','execute') or has_function_privilege('authenticated','public.boardy_discovery_overview(integer)','execute') then raise exception 'Private RPC access granted'; end if;
  if not (select relrowsecurity from pg_class where oid='public.boardy_discovery_daily'::regclass) then raise exception 'RLS missing'; end if;
  select coalesce(sum(requests),0) into before_count from public.boardy_discovery_daily where path='/learn' and kind='crawler' and source='OpenAI search' and day=(now() at time zone 'utc')::date;
  perform public.boardy_record_discovery('/learn','crawler','OpenAI search');
  perform public.boardy_record_discovery('/learn','crawler','OpenAI search');
  select sum(requests) into after_count from public.boardy_discovery_daily where path='/learn' and kind='crawler' and source='OpenAI search' and day=(now() at time zone 'utc')::date;
  if after_count<>before_count+2 then raise exception 'Counter increment failed'; end if;
  if not (public.boardy_discovery_overview(7)->'totals' ? 'crawler') then raise exception 'Aggregation missing'; end if;
end $$;
rollback;
select 'private grants, RLS, atomic counters, aggregation passed; fixtures rolled back' as result;
