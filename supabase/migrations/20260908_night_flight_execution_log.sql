create table if not exists public.night_flight_executions (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron','diagnostic')),
  status text not null check (status in ('STARTED','SUCCEEDED','FAILED')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists night_flight_executions_started_at_idx
  on public.night_flight_executions (started_at desc);

alter table public.night_flight_executions enable row level security;
