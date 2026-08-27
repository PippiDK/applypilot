import {NextResponse} from 'next/server'
import {randomUUID} from 'node:crypto'
import {requireUser} from '../../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../../lib/supabase/server.js'
import {createDiscoveryState} from '../../../lib/linkedin-profile-discovery-batch.js'
import {createPersistentSearchRun,loadPersistentSearchRun,composeSearchRunResult} from '../../../lib/search-run-store.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const isPreview=()=>process.env.VERCEL_ENV==='preview'

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const body=await request.json().catch(()=>({}))
    const freshnessDays=[1,3,7,14].includes(Number(body?.freshnessDays))?Number(body.freshnessDays):7
    const unionSearchPlan=body?.unionSearchPlan&&typeof body.unionSearchPlan==='object'?body.unionSearchPlan:{directions:[]}
    const exclusionRules=Array.isArray(body?.exclusionRules)?body.exclusionRules:[]
    if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0){
      return NextResponse.json({error:'Search Profile is not configured.'},{status:400})
    }
    const discoveryState=createDiscoveryState(unionSearchPlan)
    if(isPreview()){
      const now=new Date().toISOString()
      return NextResponse.json({mode:'preview',run:{id:`preview-${randomUUID()}`,status:'DISCOVERING',freshness_days:freshnessDays,union_search_plan:unionSearchPlan,exclusion_rules:exclusionRules,evaluation_version:'profile-v1',discovery_state:discoveryState,stats:{discovered:0,fullJdProcessed:0},coverage:{status:'SEARCHING',detail:null},created_at:now,updated_at:now},candidates:[]})
    }
    const supabase=await createServerSupabaseClient()
    const run=await createPersistentSearchRun({supabase,userId:auth.user.id,freshnessDays,unionSearchPlan,exclusionRules,discoveryState})
    return NextResponse.json({mode:'persistent',run,candidates:[]})
  }catch(error){
    console.error('create Search Run error',error)
    return NextResponse.json({error:String(error?.message||'Could not create Search Run')},{status:500})
  }
}

export async function GET(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  if(isPreview()) return NextResponse.json({error:'Preview Search Runs resume from browser session state.'},{status:409})
  try{
    const runId=new URL(request.url).searchParams.get('id')||''
    if(!runId) return NextResponse.json({error:'Search Run id is required.'},{status:400})
    const supabase=await createServerSupabaseClient()
    const snapshot=await loadPersistentSearchRun({supabase,userId:auth.user.id,runId})
    return NextResponse.json({mode:'persistent',run:snapshot.run,candidates:snapshot.candidates,result:composeSearchRunResult(snapshot.run,snapshot.candidates)})
  }catch(error){
    console.error('load Search Run error',error)
    return NextResponse.json({error:String(error?.message||'Could not load Search Run')},{status:500})
  }
}
