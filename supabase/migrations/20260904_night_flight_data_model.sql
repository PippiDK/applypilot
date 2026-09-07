create table if not exists public.night_flight_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  sources text[] not null default array['linkedin','jobindex','jobnet']::text[],
  areas text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint night_flight_settings_sources_required check (cardinality(sources) >= 1),
  constraint night_flight_settings_sources_allowed check (sources <@ array['linkedin','jobindex','jobnet']::text[]),
  constraint night_flight_settings_areas_allowed check (areas <@ array[
    'copenhagen_north','greater_copenhagen','north_zealand','rest_zealand',
    'aarhus_east_jutland','central_jutland','south_jutland','north_jutland',
    'funen','bornholm'
  ]::text[])
);

create table if not exists public.night_flight_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  search_profile jsonb not null default '{}'::jsonb,
  cv_text text not null default '',
  cv_source_version text not null default '',
  profile_fingerprint text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.night_flight_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  profile_fingerprint text not null default '',
  search_profile_snapshot jsonb not null default '{}'::jsonb,
  cv_source_version text not null default '',
  sources text[] not null,
  areas text[] not null default '{}'::text[],
  status text not null default 'PENDING',
  jobs_discovered integer not null default 0,
  jobs_queued integer not null default 0,
  jobs_ready integer not null default 0,
  jobs_failed integer not null default 0,
  jobs_skipped integer not null default 0,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint night_flight_runs_unique_user_date unique(user_id,target_date),
  constraint night_flight_runs_sources_required check (cardinality(sources) >= 1),
  constraint night_flight_runs_sources_allowed check (sources <@ array['linkedin','jobindex','jobnet']::text[]),
  constraint night_flight_runs_areas_allowed check (areas <@ array[
    'copenhagen_north','greater_copenhagen','north_zealand','rest_zealand',
    'aarhus_east_jutland','central_jutland','south_jutland','north_jutland',
    'funen','bornholm'
  ]::text[]),
  constraint night_flight_runs_status_allowed check (status in ('PENDING','RUNNING','READY','READY_WITH_ERRORS','NO_JOBS','FAILED')),
  constraint night_flight_runs_counts_nonnegative check (
    jobs_discovered >= 0 and jobs_queued >= 0 and jobs_ready >= 0 and jobs_failed >= 0 and jobs_skipped >= 0
  )
);

create table if not exists public.night_flight_jobs (
  run_id uuid not null references public.night_flight_runs(id) on delete cascade,
  job_key text not null,
  source text not null,
  job_snapshot jsonb not null default '{}'::jsonb,
  area text,
  status text not null default 'QUEUED',
  attempts integer not null default 0,
  last_error text,
  match_cache_key text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(run_id,job_key),
  constraint night_flight_jobs_source_allowed check (source in ('linkedin','jobindex','jobnet')),
  constraint night_flight_jobs_area_allowed check (
    area is null or area in (
      'copenhagen_north','greater_copenhagen','north_zealand','rest_zealand',
      'aarhus_east_jutland','central_jutland','south_jutland','north_jutland',
      'funen','bornholm'
    )
  ),
  constraint night_flight_jobs_status_allowed check (status in ('QUEUED','PROCESSING','READY','RETRY','FAILED','SKIPPED_AREA')),
  constraint night_flight_jobs_attempts_nonnegative check (attempts >= 0)
);

create index if not exists night_flight_runs_user_target_date_idx on public.night_flight_runs(user_id,target_date desc);
create index if not exists night_flight_jobs_status_idx on public.night_flight_jobs(run_id,status);

alter table public.night_flight_settings enable row level security;
alter table public.night_flight_profiles enable row level security;
alter table public.night_flight_runs enable row level security;
alter table public.night_flight_jobs enable row level security;

create policy night_flight_settings_select_own on public.night_flight_settings for select to authenticated using (auth.uid() = user_id);
create policy night_flight_settings_insert_own on public.night_flight_settings for insert to authenticated with check (auth.uid() = user_id);
create policy night_flight_settings_update_own on public.night_flight_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy night_flight_settings_delete_own on public.night_flight_settings for delete to authenticated using (auth.uid() = user_id);

create policy night_flight_profiles_select_own on public.night_flight_profiles for select to authenticated using (auth.uid() = user_id);
create policy night_flight_profiles_insert_own on public.night_flight_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy night_flight_profiles_update_own on public.night_flight_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy night_flight_profiles_delete_own on public.night_flight_profiles for delete to authenticated using (auth.uid() = user_id);

create policy night_flight_runs_select_own on public.night_flight_runs for select to authenticated using (auth.uid() = user_id);
create policy night_flight_runs_insert_own on public.night_flight_runs for insert to authenticated with check (auth.uid() = user_id);
create policy night_flight_runs_update_own on public.night_flight_runs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy night_flight_runs_delete_own on public.night_flight_runs for delete to authenticated using (auth.uid() = user_id);

create policy night_flight_jobs_select_own on public.night_flight_jobs for select to authenticated using (
  exists (select 1 from public.night_flight_runs r where r.id = run_id and r.user_id = auth.uid())
);
create policy night_flight_jobs_insert_own on public.night_flight_jobs for insert to authenticated with check (
  exists (select 1 from public.night_flight_runs r where r.id = run_id and r.user_id = auth.uid())
);
create policy night_flight_jobs_update_own on public.night_flight_jobs for update to authenticated using (
  exists (select 1 from public.night_flight_runs r where r.id = run_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from public.night_flight_runs r where r.id = run_id and r.user_id = auth.uid())
);
create policy night_flight_jobs_delete_own on public.night_flight_jobs for delete to authenticated using (
  exists (select 1 from public.night_flight_runs r where r.id = run_id and r.user_id = auth.uid())
);

grant select, insert, update, delete on public.night_flight_settings to authenticated;
grant select, insert, update, delete on public.night_flight_profiles to authenticated;
grant select, insert, update, delete on public.night_flight_runs to authenticated;
grant select, insert, update, delete on public.night_flight_jobs to authenticated;
