import {runNightFlightLastCompletedDayDiscovery} from './night-flight-last-completed-day.js'
import {persistNightFlightAreaScope} from './night-flight-area-scope.js'

export async function runNightFlightUser({supabase,userId,now=new Date(),discover=runNightFlightLastCompletedDayDiscovery,persistAreaScope=persistNightFlightAreaScope}={}){
  void supabase
  void userId
  void now
  void discover
  void persistAreaScope
  throw new Error('Night Flight per-user runner behavior not implemented')
}
