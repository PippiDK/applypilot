import {NextResponse} from 'next/server'
import {requireUser} from '../../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../../lib/supabase/server.js'
import {
  DEFAULT_NIGHT_FLIGHT_SETTINGS,
  normalizeNightFlightSettings,
  settingsFromRow
} from '../../../lib/night-flight-settings.js'

export const dynamic='force-dynamic'

export async function GET(){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    if(process.env.VERCEL_ENV==='preview'){
      return NextResponse.json({settings:DEFAULT_NIGHT_FLIGHT_SETTINGS,preview:true})
    }

    const supabase=await createServerSupabaseClient()
    const {data,error}=await supabase
      .from('night_flight_settings')
      .select('enabled,sources,areas')
      .eq('user_id',auth.user.id)
      .maybeSingle()

    if(error) throw error
    return NextResponse.json({settings:settingsFromRow(data)})
  }catch(error){
    console.error('night-flight settings read error',{code:String(error?.code||'SETTINGS_READ_FAILED')})
    return NextResponse.json({error:'Night Flight settings could not be loaded safely.'},{status:500})
  }
}

export async function PUT(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response

  try{
    const body=await request.json().catch(()=>null)
    const settings=normalizeNightFlightSettings(body)

    if(process.env.VERCEL_ENV==='preview'){
      return NextResponse.json({ok:true,settings,preview:true})
    }

    const supabase=await createServerSupabaseClient()
    const row={
      user_id:auth.user.id,
      ...settings,
      updated_at:new Date().toISOString()
    }
    const {error}=await supabase
      .from('night_flight_settings')
      .upsert(row,{onConflict:'user_id'})

    if(error) throw error
    return NextResponse.json({ok:true,settings})
  }catch(error){
    const message=String(error?.message||'')
    if(message.startsWith('Night Flight ')||message.startsWith('At least one ')||message.startsWith('Unsupported Night Flight ')){
      return NextResponse.json({error:message},{status:400})
    }
    console.error('night-flight settings write error',{code:String(error?.code||'SETTINGS_WRITE_FAILED')})
    return NextResponse.json({error:'Night Flight settings could not be saved safely.'},{status:500})
  }
}
