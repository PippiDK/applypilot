import {createHash} from 'node:crypto'
import {NextResponse} from 'next/server'
import {createAdminSupabaseClient} from '../../../lib/supabase/admin.js'
import {runNightFlightScheduler} from '../../../lib/night-flight-scheduler.js'

export const dynamic='force-dynamic'

const TEST_SUPABASE_URL='https://tafdswfdblxoehreaalm.supabase.co'
const DIAGNOSTIC_TOKEN_SHA256='44ada9ba83677d21d3e91cc4ea5cc50c6d207ffc6264c3008d53a26d22a24ab6'
const clean=value=>String(value??'').trim()
const sha256=value=>createHash('sha256').update(clean(value)).digest('hex')

function diagnosticAuthorized(request){
  const token=clean(new URL(request.url).searchParams.get('diagnostic'))
  return Boolean(token)&&sha256(token)===DIAGNOSTIC_TOKEN_SHA256
}

function createNightFlightAdminSupabase(){
  if(process.env.VERCEL_ENV==='preview'){
    return createAdminSupabaseClient({
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:TEST_SUPABASE_URL,
    })
  }
  return createAdminSupabaseClient()
}

async function startExecution(supabase,trigger){
  const {data,error}=await supabase
    .from('night_flight_executions')
    .insert({trigger,status:'STARTED'})
    .select('id')
    .single()
  if(error||!data?.id) throw new Error(`Night Flight execution log start failed: ${error?.message||'missing execution id'}`)
  return data.id
}

async function finishExecution(supabase,id,{status,result=null,error=null}){
  if(!id) return
  const {error:updateError}=await supabase
    .from('night_flight_executions')
    .update({
      status,
      result,
      error:error?clean(error).slice(0,2000):null,
      finished_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    })
    .eq('id',id)
  if(updateError) throw new Error(`Night Flight execution log finish failed: ${updateError.message||'unknown Supabase error'}`)
}

export async function GET(request){
  const secret=clean(process.env.CRON_SECRET)
  const authorization=clean(request.headers.get('authorization'))
  const cronAuthorized=Boolean(secret)&&authorization===`Bearer ${secret}`
  const isDiagnostic=diagnosticAuthorized(request)
  if(!cronAuthorized&&!isDiagnostic){
    return NextResponse.json({error:'Unauthorized'},{status:401})
  }

  let supabase
  let executionId=''
  try{
    supabase=createNightFlightAdminSupabase()
    executionId=await startExecution(supabase,isDiagnostic?'diagnostic':'cron')
    const result=await runNightFlightScheduler({supabase})
    const failed=Number(result?.usersFailed||0)>0
    await finishExecution(supabase,executionId,{
      status:failed?'FAILED':'SUCCEEDED',
      result,
      error:failed?JSON.stringify(result?.failures||[]):null,
    })
    return NextResponse.json(result,{status:failed?500:200})
  }catch(error){
    const message=clean(error?.message||error)||'Night Flight scheduler failed'
    console.error('[night-flight-cron] failed',message)
    if(supabase&&executionId){
      try{await finishExecution(supabase,executionId,{status:'FAILED',error:message})}catch(logError){
        console.error('[night-flight-cron] execution log failed',clean(logError?.message||logError))
      }
    }
    return NextResponse.json({error:'Night Flight scheduler failed',detail:message},{status:500})
  }
}
