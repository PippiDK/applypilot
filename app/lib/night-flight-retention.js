const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'
export const NIGHT_FLIGHT_RETENTION_DAYS=15
export const NIGHT_FLIGHT_TERMINAL_STATUSES=['READY','READY_WITH_ERRORS','NO_JOBS','FAILED']

function resolveNow(now){
  const value=now instanceof Date?now:new Date(now??Date.now())
  if(!Number.isFinite(value.getTime())) throw new Error('Night Flight retention time is invalid')
  return value
}

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Night Flight retention requires Supabase')
}

export function nightFlightRetentionCutoffDate(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:COPENHAGEN_TIME_ZONE,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
  }).formatToParts(resolveNow(now))
  const year=Number(parts.find(part=>part.type==='year')?.value)
  const month=Number(parts.find(part=>part.type==='month')?.value)
  const day=Number(parts.find(part=>part.type==='day')?.value)
  const localCalendarUtc=Date.UTC(year,month-1,day)
  return new Date(localCalendarUtc-NIGHT_FLIGHT_RETENTION_DAYS*86400000).toISOString().slice(0,10)
}

export async function cleanupNightFlightRuns({supabase,now=new Date()}={}){
  requireSupabase(supabase)
  const cutoffDate=nightFlightRetentionCutoffDate(now)
  const {data,error}=await supabase
    .from('night_flight_runs')
    .delete()
    .lt('target_date',cutoffDate)
    .in('status',NIGHT_FLIGHT_TERMINAL_STATUSES)
    .select('id,target_date,status')

  if(error) throw new Error(`Night Flight retention cleanup failed: ${error.message||'unknown Supabase error'}`)
  const rows=Array.isArray(data)?data:[]
  return {
    cutoffDate,
    deletedRuns:rows.length,
    deletedRunIds:rows.map(row=>String(row?.id??'').trim()).filter(Boolean),
  }
}
