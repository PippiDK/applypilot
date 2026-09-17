create table if not exists public.applied_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  title text not null,
  company text not null,
  location text not null default '',
  source text not null default 'LinkedIn',
  original_url text not null default '',
  published_at text,
  applied_at timestamptz not null,
  relevance_score numeric,
  primary key (user_id, job_id)
);

alter table public.applied_jobs enable row level security;

create policy "Users can read own applied jobs"
on public.applied_jobs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own applied jobs"
on public.applied_jobs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own applied jobs"
on public.applied_jobs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
