-- Applied History application lifecycle: preserve APPLIED and INTERVIEW in one durable archive.
-- Existing rows remain APPLIED. No rows are deleted or rewritten.
alter table public.applied_jobs
  add column if not exists application_status text not null default 'applied';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applied_jobs_application_status_check'
      and conrelid = 'public.applied_jobs'::regclass
  ) then
    alter table public.applied_jobs
      add constraint applied_jobs_application_status_check
      check (application_status in ('applied','interview'));
  end if;
end
$$;
