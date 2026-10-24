import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createAdminSupabaseClient} from '../../lib/supabase/admin.js'
import {executeManualNightFlight,listManualNightFlights,ManualNightFlightError} from '../../lib/night-flight-manual-control.js'

export const dynamic='force-dynamic'
export const maxDuration=300

async function context(){
  // Legacy preview auth uses a synthetic user. NEVER allow privileged writes through it.
  if(process.env.VERCEL_ENV==='preview') return {response:NextResponse.json({error:'Manual Night Flight unavailable in preview'},{status:403})}
  const auth=await requireUser()
  if(!auth.user) return {response:auth.response}
  return {userId:auth.user.id,supabase:createAdminSupabaseClient()}
}

function safeError(error){
  if(error instanceof ManualNightFlightError) return NextResponse.json({error:error.message},{status:error.status})
  console.error('[night-flight-manual] failed',{name:error?.name||'Error'})
  return NextResponse.json({error:'Manual Night Flight could not be completed. Check run status before retrying.'},{status:500})
}

export async function GET(){
  try{
    const ctx=await context()
    if(ctx.response) return ctx.response
    return NextResponse.json(await listManualNightFlights(ctx))
  }catch(error){return safeError(error)}
}

export async function POST(request){
  const origin=request.headers.get('origin')
  if(!origin||origin!==new URL(request.url).origin){
    return NextResponse.json({error:'Invalid request origin'},{status:403})
  }
  try{
    const ctx=await context()
    if(ctx.response) return ctx.response
    const body=await request.json()
    if(!body||typeof body!=='object'||Array.isArray(body)){
      return NextResponse.json({error:'Invalid request body'},{status:400})
    }
    return NextResponse.json(await executeManualNightFlight({
      ...ctx,mode:body.mode,runId:body.runId,jobKey:body.jobKey,
    }))
  }catch(error){return safeError(error)}
}
