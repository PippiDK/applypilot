create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'DISCOVERING' check (status in ('DISCOVERING','READING_JDS','COMPLETE','ACCESS_LIMITED','FAILED','CANCELLED')),
  freshness_days integer not null check (freshness_days in (1,3,7,14)),
  union_search_plan jsonb not null default '{}'::jsonb,
  exclusion_rules jsonb not null default '[]'::jsonb,
  evaluation_version text not null default 'profile-v1',
  discovery_state jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.search_candidates (
  run_id uuid not null references public.search_runs(id) on delete cascade,
  job_id text not null,
  candidate jsonb not null default '{}'::jsonb,
  found_by jsonb not null default '[]'::jsonb,
  detail_status text not null default 'PENDING' check (detail_status in ('PENDING','PROCESSING','PROCESSED','UNVERIFIED')),
  job jsonb,
  evaluation jsonb,
  audit jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, job_id)
);

create index search_runs_user_created_idx on public.search_runs(user_id, created_at desc);
create index search_candidates_run_status_idx on public.search_candidates(run_id, detail_status);

alter table public.search_runs enable row level security;
alter table public.search_candidates enable row level security;

grant select, insert, update, delete on public.search_runs to authenticated;
grant select, insert, update, delete on public.search_candidates to authenticated;

create policy search_runs_select_own on public.search_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy search_runs_insert_own on public.search_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy search_runs_update_own on public.search_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy search_runs_delete_own on public.search_runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy search_candidates_select_own on public.search_candidates for select to authenticated using (exists (select 1 from public.search_runs r where r.id = search_candidates.run_id and r.user_id = (select auth.uid())));
create policy search_candidates_insert_own on public.search_candidates for insert to authenticated with check (exists (select 1 from public.search_runs r where r.id = search_candidates.run_id and r.user_id = (select auth.uid())));
create policy search_candidates_update_own on public.search_candidates for update to authenticated using (exists (select 1 from public.search_runs r where r.id = search_candidates.run_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.search_runs r where r.id = search_candidates.run_id and r.user_id = (select auth.uid())));
create policy search_candidates_delete_own on public.search_candidates for delete to authenticated using (exists (select 1 from public.search_runs r where r.id = search_candidates.run_id and r.user_id = (select auth.uid())));
