import { DEFAULT_NIGHT_FLIGHT_SETTINGS, normalizeNightFlightSettings, validateNightFlightSettings } from './night-flight-settings.js'

function requireStoreInputs({supabase,userId}={}){
  if(!userId) throw new Error('Authenticated user is required')
  if(!supabase||typeof supabase.from!=='function') throw new Error('Supabase client is required')
}

export async function loadNightFlightSettings({supabase,userId}={}){
  requireStoreInputs({supabase,userId})
  const {data,error}=await supabase
    .from('night_flight_settings')
    .select('enabled, sources, areas, updated_at')
    .eq('user_id',userId)
    .maybeSingle()

  if(error) throw new Error(`Night Flight settings read failed: ${error.message||'unknown Supabase error'}`)
  return normalizeNightFlightSettings(data||DEFAULT_NIGHT_FLIGHT_SETTINGS)
}

export async function saveNightFlightSettings({supabase,userId,settings,now=new Date().toISOString()}={}){
  requireStoreInputs({supabase,userId})
  const validated=validateNightFlightSettings(settings)
  const payload={
    user_id:userId,
    enabled:validated.enabled,
    sources:validated.sources,
    areas:validated.areas,
    updated_at:now,
  }
  const {error}=await supabase
    .from('night_flight_settings')
    .upsert(payload,{onConflict:'user_id'})

  if(error) throw new Error(`Night Flight settings save failed: ${error.message||'unknown Supabase error'}`)
  return {...validated,updatedAt:now}
}
