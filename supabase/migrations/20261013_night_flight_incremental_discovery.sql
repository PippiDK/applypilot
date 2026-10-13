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
    where u.phase <> 'DONE' and r.state='DISCOVERING'
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
 p_candidates jsonb,p_jobs jsonb,p_error text default null
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
     lease_owner=null,lease_until=null,updated_at=clock_timestamp()
 where id=p_id and lease_owner=p_owner and lease_until>clock_timestamp();
 get diagnostics affected=row_count;
 return affected=1;
end $$;
revoke all on function public.save_night_flight_discovery_unit(uuid,uuid,text,integer,integer,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_night_flight_discovery_unit(uuid,uuid,text,integer,integer,jsonb,jsonb,text) to service_role;
