alter table public.night_flight_jobs
add column if not exists already_applied boolean not null default false;
