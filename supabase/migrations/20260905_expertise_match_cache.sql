alter table public.night_flight_runs
  add column if not exists cv_text_snapshot text not null default '';

create table if not exists public.expertise_match_cache (
  cache_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  logical_job_key text not null,
  profile_fingerprint text not null,
  engine_version text not null,
  analysis jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expertise_match_cache_identity_unique unique(user_id,logical_job_key,profile_fingerprint,engine_version)
);

create index if not exists expertise_match_cache_user_idx
  on public.expertise_match_cache(user_id,updated_at desc);

alter table public.expertise_match_cache enable row level security;

create policy expertise_match_cache_select_own
  on public.expertise_match_cache for select to authenticated
  using (auth.uid() = user_id);

create policy expertise_match_cache_insert_own
  on public.expertise_match_cache for insert to authenticated
  with check (auth.uid() = user_id);

create policy expertise_match_cache_update_own
  on public.expertise_match_cache for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy expertise_match_cache_delete_own
  on public.expertise_match_cache for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.expertise_match_cache to authenticated;
