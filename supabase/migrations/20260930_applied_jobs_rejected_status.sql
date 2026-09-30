-- Applied History lifecycle: add REJECTED while preserving all existing rows.
-- No application records are deleted or rewritten.
alter table public.applied_jobs
  drop constraint if exists applied_jobs_application_status_check;

alter table public.applied_jobs
  add constraint applied_jobs_application_status_check
  check (application_status in ('applied','interview','rejected'));
