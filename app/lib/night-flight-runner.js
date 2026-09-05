import {runNightFlightLastCompletedDayDiscovery} from './night-flight-last-completed-day.js'
import {persistNightFlightAreaScope} from './night-flight-area-scope.js'

export async function runNightFlightUser({
  supabase,
  userId,
  now=new Date(),
  discover=runNightFlightLastCompletedDayDiscovery,
  persistAreaScope=persistNightFlightAreaScope,
}={}){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Supabase client is required')
  if(!String(userId||'').trim()) throw new Error('Night Flight user id is required')
  if(typeof discover!=='function') throw new Error('Night Flight discovery runner is required')
  if(typeof persistAreaScope!=='function') throw new Error('Night Flight persistence runner is required')

  const batch=await discover({supabase,userId,now})
  return persistAreaScope({supabase,userId,batch})
}
