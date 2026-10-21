-- Night Pilot only: retain explicit partial-discovery diagnostics after bounded retries.
alter table public.night_flight_runs
 add column if not exists discovery_failures integer not null default 0
 check(discovery_failures >= 0);

create or replace function public.mark_night_flight_partial_discovery()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.discovery_failures>0 and new.status in ('READY','NO_JOBS') then
   new.status='READY_WITH_ERRORS';
 end if;
 return new;
end $$;
drop trigger if exists night_flight_partial_discovery_status on public.night_flight_runs;
create trigger night_flight_partial_discovery_status
 before insert or update on public.night_flight_runs
 for each row execute function public.mark_night_flight_partial_discovery();

-- Use original atomic freeze in the same transaction; attach verified
-- failure count before commit so Match reconciliation cannot erase it.
create or replace function public.freeze_night_flight_discovery_with_failures(
 p_discovery_run_id uuid,p_rows jsonb,p_failures integer
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 run_id uuid;
 prior_id uuid;
 current_state text;
begin
 if p_failures<0 then raise exception 'invalid discovery failure count'; end if;
 select state into current_state from public.night_flight_discovery_runs
  where id=p_discovery_run_id for update;
 if current_state is null then raise exception 'discovery run missing'; end if;
 select r.id into prior_id from public.night_flight_runs r
   join public.night_flight_discovery_runs d
     on d.user_id=r.user_id and d.target_date=r.target_date
   where d.id=p_discovery_run_id;
 run_id:=public.freeze_night_flight_discovery(p_discovery_run_id,p_rows);
 if current_state='FROZEN' or prior_id is not null then return run_id; end if;
 update public.night_flight_runs
  set discovery_failures=p_failures,
      last_error=case when p_failures>0 then
        'Night Pilot discovery incomplete: '||p_failures::text||' source/JD retrieval failure(s)'
        else null end,
      status=case when p_failures>0 and status='NO_JOBS'
        then 'READY_WITH_ERRORS' else status end
  where id=run_id;
 return run_id;
end $$;
revoke all on function public.freeze_night_flight_discovery_with_failures(uuid,jsonb,integer)
 from public,anon,authenticated;
grant execute on function public.freeze_night_flight_discovery_with_failures(uuid,jsonb,integer)
 to service_role;
