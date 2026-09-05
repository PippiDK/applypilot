import { NextResponse } from 'next/server'
import { requireUser } from '../../lib/auth/require-user.js'
import { createServerSupabaseClient } from '../../lib/supabase/server.js'
import { NightFlightSettingsValidationError } from '../../lib/night-flight-settings.js'
import { loadNightFlightSettings, saveNightFlightSettings } from '../../lib/night-flight-settings-store.js'

export const dynamic='force-dynamic'

export async function GET(){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const supabase=await createServerSupabaseClient()
    const settings=await loadNightFlightSettings({supabase,userId:auth.user.id})
    return NextResponse.json({settings})
  }catch(error){
    console.error('night-flight-settings read error',{message:error?.message||'unknown'})
    return NextResponse.json({error:error?.message||'Night Flight settings could not be loaded.'},{status:500})
  }
}

export async function PUT(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json()
    const supabase=await createServerSupabaseClient()
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
