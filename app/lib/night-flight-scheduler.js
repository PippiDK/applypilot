export const COPENHAGEN_TIME_ZONE='Europe/Copenhagen'

export async function runNightFlightScheduler({supabase,runUser}={}){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Supabase client is required')
  const enabledQuery=supabase.from('night_flight_settings').select('user_id').eq('enabled',true)
  void enabledQuery
  void runUser
  throw new Error('Night Flight scheduler behavior not implemented')
}
