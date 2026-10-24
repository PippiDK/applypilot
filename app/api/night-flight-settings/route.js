import { NextResponse } from 'next/server'
import { resolveNightFlightRequestContext } from '../../lib/night-flight-preview-context.js'
import { NightFlightSettingsValidationError } from '../../lib/night-flight-settings.js'
import { loadNightFlightSettings, saveNightFlightSettings } from '../../lib/night-flight-settings-store.js'

export const dynamic='force-dynamic'

export async function GET(){
  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response

  try{
    const settings=await loadNightFlightSettings({supabase,userId:auth.user.id})
    return NextResponse.json({settings})
  }catch(error){
    console.error('night-flight-settings read error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight settings could not be loaded.'},{status:500})
  }
}

export async function PUT(request){
  const {auth,supabase}=await resolveNightFlightRequestContext()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const settings=await saveNightFlightSettings({
      supabase,
      userId:auth.user.id,
      settings:body?.settings??body,
    })
    return NextResponse.json({settings})
  }catch(error){
    if(error instanceof NightFlightSettingsValidationError){
      const message=error?.message||'Select at least one source.'
      return NextResponse.json({error:message},{status: 400})
    }
    console.error('night-flight-settings save error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight settings could not be saved.'},{status:500})
  }
}
