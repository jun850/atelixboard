create extension if not exists supabase_vault with schema vault;

create table public.ai_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic')),
  label text not null default '',
  key_suffix text not null check (char_length(key_suffix) between 1 and 12),
  secret_id uuid not null unique,
  models jsonb not null default '[]'::jsonb check (jsonb_typeof(models) = 'array'),
  models_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create index ai_connections_user_id_idx on public.ai_connections(user_id);

create table public.ai_user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_connection_id uuid,
  default_model text check (default_model is null or char_length(default_model) <= 200),
  default_task text not null default 'board' check (default_task in ('board', 'ui')),
  default_context text not null default 'prompt_only'
    check (default_context in ('prompt_only', 'selection')),
  persist_local_history boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key (user_id, default_connection_id)
    references public.ai_connections(user_id, id)
    on delete set null (default_connection_id)
);

create table public.ai_generation_requests (
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{16,80}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  status text not null check (status in ('running', 'complete', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, request_id),
  foreign key (user_id, connection_id)
    references public.ai_connections(user_id, id) on delete cascade
);

create unique index ai_generation_one_active_per_user
  on public.ai_generation_requests(user_id)
  where status = 'running';

alter table public.ai_connections enable row level security;
alter table public.ai_user_preferences enable row level security;
alter table public.ai_generation_requests enable row level security;

create policy "Users can read their AI connection metadata"
  on public.ai_connections for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their assistant preferences"
  on public.ai_user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their assistant preferences"
  on public.ai_user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their assistant preferences"
  on public.ai_user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.ai_connections from anon, authenticated;
grant select on public.ai_connections to authenticated;
revoke all on public.ai_user_preferences from anon, authenticated;
grant select, insert, update, delete on public.ai_user_preferences to authenticated;
revoke all on public.ai_generation_requests from anon, authenticated;

create or replace function public.agentic_store_connection_secret(
  connection_id uuid,
  owner_id uuid,
  connection_provider text,
  connection_label text,
  connection_key text,
  connection_suffix text,
  discovered_models jsonb
)
returns public.ai_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  vault_secret_id uuid;
  result public.ai_connections;
begin
  if connection_provider not in ('openai', 'anthropic')
     or char_length(connection_key) not between 10 and 1000
     or jsonb_typeof(discovered_models) <> 'array' then
    raise exception 'invalid connection';
  end if;

  select vault.create_secret(
    connection_key,
    'boardy-ai-' || owner_id::text || '-' || connection_id::text,
    'Boardy user-supplied provider credential'
  ) into vault_secret_id;

  insert into public.ai_connections (
    id, user_id, provider, label, key_suffix, secret_id, models,
    models_refreshed_at, updated_at
  ) values (
    connection_id, owner_id, connection_provider, connection_label,
    connection_suffix, vault_secret_id, discovered_models, now(), now()
  )
  returning * into result;

  return result;
end;
$$;

create or replace function public.agentic_replace_connection_secret(
  connection_id uuid,
  owner_id uuid,
  connection_key text,
  connection_suffix text,
  discovered_models jsonb
)
returns public.ai_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.ai_connections;
  result public.ai_connections;
begin
  select * into existing from public.ai_connections
    where id = connection_id and user_id = owner_id for update;
  if not found or char_length(connection_key) not between 10 and 1000 then
    raise exception 'connection unavailable';
  end if;

  perform vault.update_secret(existing.secret_id, connection_key);
  update public.ai_connections
    set key_suffix = connection_suffix,
        models = discovered_models,
        models_refreshed_at = now(),
        updated_at = now()
    where id = connection_id and user_id = owner_id
    returning * into result;
  return result;
end;
$$;

create or replace function public.agentic_read_connection_secret(
  connection_id uuid,
  owner_id uuid
)
returns table (provider text, secret text, models jsonb, models_refreshed_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select c.provider, s.decrypted_secret, c.models, c.models_refreshed_at
  from public.ai_connections c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.id = connection_id and c.user_id = owner_id;
$$;

create or replace function public.agentic_delete_connection(
  connection_id uuid,
  owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  vault_secret_id uuid;
begin
  delete from public.ai_connections
    where id = connection_id and user_id = owner_id
    returning secret_id into vault_secret_id;
  if vault_secret_id is not null then
    delete from vault.secrets where id = vault_secret_id;
  end if;
end;
$$;

revoke all on function public.agentic_store_connection_secret(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.agentic_replace_connection_secret(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.agentic_read_connection_secret(uuid, uuid) from public, anon, authenticated;
revoke all on function public.agentic_delete_connection(uuid, uuid) from public, anon, authenticated;
grant execute on function public.agentic_store_connection_secret(uuid, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.agentic_replace_connection_secret(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.agentic_read_connection_secret(uuid, uuid) to service_role;
grant execute on function public.agentic_delete_connection(uuid, uuid) to service_role;
