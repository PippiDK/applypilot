-- Night Pilot only: durable discovery checkpoints and atomic work claiming.
-- No normal Search tables, adapters, or business rules are shared.
create table if not exists public.night_flight_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  search_profile_snapshot jsonb not null,
  cv_text_snapshot text not null default '',
  cv_source_version text not null default '',
  profile_fingerprint text not null default '',
  sources text[] not null,
  areas text[] not null,
  expanded_plan jsonb not null,
  initialized boolean not null default false,
  state text not null default 'DISCOVERING'
    check (state in ('DISCOVERING','FROZEN','FAILED')),
  frozen_run_id uuid references public.night_flight_runs(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,target_date),
  check (cardinality(sources) > 0),
  check (sources <@ array['linkedin','jobindex','jobnet']::text[])
);
create table if not exists public.night_flight_discovery_units (
  id uuid primary key default gen_random_uuid(),
  discovery_run_id uuid not null references public.night_flight_discovery_runs(id) on delete cascade,
  source text not null check (source in ('linkedin','jobindex','jobnet')),
  direction_index integer not null check (direction_index >= 0),
  phase text not null default 'DISCOVERY' check (phase in ('DISCOVERY','DETAIL','DONE')),
  next_page integer not null default 0 check (next_page >= 0),
  next_detail integer not null default 0 check (next_detail >= 0),
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates)='array'),
  verified_jobs jsonb not null default '[]'::jsonb check (jsonb_typeof(verified_jobs)='array'),
  lease_owner uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discovery_run_id,source,direction_index)
);
create index if not exists night_flight_discovery_units_work_idx
  on public.night_flight_discovery_units(phase,lease_until,created_at);
create index if not exists night_flight_discovery_runs_user_date_idx
  on public.night_flight_discovery_runs(user_id,target_date desc);

alter table public.night_flight_discovery_runs enable row level security;
alter table public.night_flight_discovery_units enable row level security;
revoke all on public.night_flight_discovery_runs from anon,authenticated;
revoke all on public.night_flight_discovery_units from anon,authenticated;

-- Claims are transactional: concurrent cron invocations cannot own one work unit.
-- Only service_role may execute this definer function.
create or replace function public.claim_night_flight_discovery_unit(
  p_owner uuid, p_lease_seconds integer default 180
) returns setof public.night_flight_discovery_units
language plpgsql security definer set search_path = ''
as $$
declare claimed_id uuid;
begin
  if p_owner is null then raise exception 'claim owner required'; end if;
  select u.id into claimed_id
    from public.night_flight_discovery_units u
    join public.night_flight_discovery_runs r on r.id=u.discovery_run_id
    where u.phase <> 'DONE' and r.state='DISCOVERING' and r.initialized=true
      and (u.lease_until is null or u.lease_until < clock_timestamp())
    order by r.target_date asc,u.created_at asc,u.source,u.direction_index
    for update of u skip locked limit 1;
  if claimed_id is null then return; end if;
  return query update public.night_flight_discovery_units u
    set lease_owner=p_owner,
        lease_until=clock_timestamp()+make_interval(secs=>least(greatest(p_lease_seconds,30),240)),
        attempts=u.attempts+1,
        updated_at=clock_timestamp()
    where u.id=claimed_id returning u.*;
end $$;
revoke all on function public.claim_night_flight_discovery_unit(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_night_flight_discovery_unit(uuid,integer) to service_role;

-- An expired claimant must never overwrite a newer claimant's checkpoint.
create or replace function public.save_night_flight_discovery_unit(
 p_id uuid, p_owner uuid, p_phase text,p_page integer,p_detail integer,
 p_candidates jsonb,p_jobs jsonb,p_error text default null,p_retry_seconds integer default 0
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare affected integer;
begin
 if p_phase not in ('DISCOVERY','DETAIL','DONE')
    or p_page<0 or p_detail<0
    or jsonb_typeof(p_candidates)<>'array' or jsonb_typeof(p_jobs)<>'array'
 then raise exception 'invalid checkpoint'; end if;
 update public.night_flight_discovery_units
 set phase=p_phase,next_page=p_page,next_detail=p_detail,
     candidates=p_candidates,verified_jobs=p_jobs,last_error=left(p_error,500),
     lease_owner=null,lease_until=case when p_retry_seconds>0 then clock_timestamp()+make_interval(secs=>least(p_retry_seconds,86400)) else null end,updated_at=clock_timestamp()
 where id=p_id and lease_owner=p_owner and lease_until>clock_timestamp();
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function public.save_night_flight_discovery_unit(uuid,uuid,text,integer,integer,jsonb,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.save_night_flight_discovery_unit(uuid,uuid,text,integer,integer,jsonb,jsonb,text,integer) to service_role;

-- Transactional freeze prevents exposing a partly written run to Match worker.
create or replace function public.freeze_night_flight_discovery(
 p_discovery_run_id uuid, p_rows jsonb
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 header public.night_flight_discovery_runs%rowtype;
 result_id uuid;
 existing_id uuid;
 discovered integer;
 queued integer;
 skipped integer;
begin
 if jsonb_typeof(p_rows)<>'array' then raise exception 'invalid frozen jobs'; end if;
 select * into header from public.night_flight_discovery_runs
  where id=p_discovery_run_id for update;
 if not found then raise exception 'discovery run not found'; end if;
 if exists(select 1 from public.night_flight_discovery_units
   where discovery_run_id=p_discovery_run_id and phase<>'DONE') then
   raise exception 'discovery cannot freeze while work remains';
 end if;
 if header.state='FROZEN' and header.frozen_run_id is not null then
   return header.frozen_run_id;
 end if;
 if not header.initialized then raise exception 'discovery not initialized'; end if;
 if header.state<>'DISCOVERING' then raise exception 'discovery not active'; end if;
 select id into existing_id from public.night_flight_runs
  where user_id=header.user_id and target_date=header.target_date;
 if existing_id is not null then
   update public.night_flight_discovery_runs
    set state='FROZEN',frozen_run_id=existing_id,updated_at=clock_timestamp()
    where id=header.id;
   return existing_id;
 end if;
 select count(*),count(*) filter(where status='QUEUED'),
  count(*) filter(where status='SKIPPED_AREA')
 into discovered,queued,skipped
 from jsonb_to_recordset(p_rows) as x(
  job_key text,source text,job_snapshot jsonb,area text,status text);
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(
   job_key text,source text,job_snapshot jsonb,area text,status text)
   where nullif(x.job_key,'') is null or x.source not in ('linkedin','jobindex','jobnet')
     or x.status not in ('QUEUED','SKIPPED_AREA') or x.job_snapshot is null)
 then raise exception 'invalid frozen job row'; end if;
 insert into public.night_flight_runs(user_id,target_date,profile_fingerprint,
  search_profile_snapshot,cv_text_snapshot,cv_source_version,sources,areas,
  status,jobs_discovered,jobs_queued,jobs_skipped,started_at)
 values(header.user_id,header.target_date,header.profile_fingerprint,
  header.search_profile_snapshot,header.cv_text_snapshot,header.cv_source_version,
  header.sources,header.areas,
  case when discovered=0 then 'NO_JOBS' else 'RUNNING' end,
  discovered,queued,skipped,clock_timestamp())
 returning id into result_id;
 insert into public.night_flight_jobs(run_id,job_key,source,job_snapshot,area,status)
 select result_id,x.job_key,x.source,x.job_snapshot,x.area,x.status
 from jsonb_to_recordset(p_rows) as x(
  job_key text,source text,job_snapshot jsonb,area text,status text);
 update public.night_flight_discovery_runs
   set state='FROZEN',frozen_run_id=result_id,updated_at=clock_timestamp()
   where id=p_discovery_run_id;
 return result_id;
end $$;
revoke all on function public.freeze_night_flight_discovery(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.freeze_night_flight_discovery(uuid,jsonb) to service_role;
