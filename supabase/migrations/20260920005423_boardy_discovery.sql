-- Private by default. The Edge Function validates the confirmed owner via Auth.
create table public.boardy_discovery_daily (
  day date not null default (now() at time zone 'utc')::date,
  path text not null check (length(path) <= 160),
  kind text not null check (kind in ('crawler', 'ai_referral', 'page_request')),
  source text not null check (length(source) <= 64),
  requests bigint not null default 1,
  primary key (day, path, kind, source)
);
alter table public.boardy_discovery_daily enable row level security;
revoke all on public.boardy_discovery_daily from public, anon, authenticated;
grant all on public.boardy_discovery_daily to service_role;

create table public.boardy_discovery_checks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prompt_index integer not null check (prompt_index between 0 and 4),
  engine text not null check (engine in ('ChatGPT','Claude','Gemini','Perplexity','Copilot','Other')),
  answer text not null check (length(answer) between 1 and 20000),
  mentioned boolean not null,
  cited boolean not null,
  evidence_url text check (length(evidence_url) <= 2000),
  recorded_by uuid not null references auth.users(id)
);
create index boardy_discovery_checks_created on public.boardy_discovery_checks (created_at desc);
alter table public.boardy_discovery_checks enable row level security;
revoke all on public.boardy_discovery_checks from public, anon, authenticated;
grant all on public.boardy_discovery_checks to service_role;

-- One atomic write per observed public request. No raw IPs, URLs, UA, or cookies.
create function public.boardy_record_discovery(p_path text, p_kind text, p_source text)
returns void language sql security invoker set search_path = '' as $$
  insert into public.boardy_discovery_daily (path, kind, source)
  values (p_path, p_kind, p_source)
  on conflict (day, path, kind, source) do update
  set requests = least(public.boardy_discovery_daily.requests + 1, 1000000);
$$;
revoke all on function public.boardy_record_discovery(text,text,text) from public, anon, authenticated;
grant execute on function public.boardy_record_discovery(text,text,text) to service_role;

-- Aggregate in SQL rather than paginating raw events through PostgREST.
create function public.boardy_discovery_overview(p_days integer default 30)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with traffic as (
    select * from public.boardy_discovery_daily
    where day >= (now() at time zone 'utc')::date - (greatest(1, least(p_days,90)) - 1)
  ), checks as (
    select * from public.boardy_discovery_checks
    where created_at >= ((now() at time zone 'utc')::date - (greatest(1, least(p_days,90)) - 1)) at time zone 'utc'
  )
  select jsonb_build_object(
    'totals', coalesce((select jsonb_object_agg(kind,n) from (select kind,sum(requests) n from traffic group by kind) t),'{}'::jsonb),
    'daily', coalesce((select jsonb_agg(t order by day desc) from (select day,sum(requests) requests from traffic group by day) t),'[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t order by requests desc) from (select source,kind,sum(requests) requests from traffic group by source,kind) t),'[]'::jsonb),
    'pages', coalesce((select jsonb_agg(t order by requests desc) from (select path,sum(requests) requests from traffic group by path) t),'[]'::jsonb),
    'checks', jsonb_build_object('total',(select count(*) from checks),'mentioned',(select count(*) from checks where mentioned),'cited',(select count(*) from checks where cited)),
    'recentChecks', coalesce((select jsonb_agg(t order by created_at desc) from (select * from checks order by created_at desc limit 25) t),'[]'::jsonb)
  );
$$;
revoke all on function public.boardy_discovery_overview(integer) from public, anon, authenticated;
grant execute on function public.boardy_discovery_overview(integer) to service_role;
