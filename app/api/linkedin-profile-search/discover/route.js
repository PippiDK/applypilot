import {NextResponse} from 'next/server'
import {requireUser} from '../../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../../lib/supabase/server.js'
import {createLinkedInStableFetcher} from '../../../lib/linkedin-stable-fetcher.js'
import {runDiscoveryBatch} from '../../../lib/linkedin-profile-discovery-batch.js'
import {loadPersistentSearchRun,updatePersistentSearchRun,upsertPersistentCandidates} from '../../../lib/search-run-store.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120

const isPreview=()=>process.env.VERCEL_ENV==='preview'
const candidateFromRow=row=>({...row.candidate,jobId:String(row.job_id),foundBy:Array.isArray(row.found_by)?row.found_by:[]})

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const body=await request.json().catch(()=>({}))
    const fetcher=createLinkedInStableFetcher({totalBudgetMs:90000})

    if(isPreview()){
      const run=body?.run||{}
      const candidates=Array.isArray(body?.candidates)?body.candidates:[]
      const result=await runDiscoveryBatch({freshnessDays:run.freshness_days,unionSearchPlan:run.union_search_plan,state:run.discovery_state,knownCandidates:candidates,fetcher,maxRequests:8})
      const nextRun={...run,status:result.complete?'READING_JDS':'DISCOVERING',discovery_state:result.state,stats:{...(run.stats||{}),discovered:result.candidates.length},coverage:{status:result.accessLimited?'ACCESS LIMITED':result.complete?'SEARCHED':'SEARCHING',detail:result.coverage?.detail||null},updated_at:new Date().toISOString()}
      return NextResponse.json({mode:'preview',run:nextRun,candidates:result.candidates,complete:result.complete,progress:{discovered:result.candidates.length}})
    }

    const runId=String(body?.runId||'')
    if(!runId) return NextResponse.json({error:'Search Run id is required.'},{status:400})
    const supabase=await createServerSupabaseClient()
    const snapshot=await loadPersistentSearchRun({supabase,userId:auth.user.id,runId})
    if(!['DISCOVERING','READING_JDS'].includes(snapshot.run.status)) return NextResponse.json({error:`Search Run cannot discover from status ${snapshot.run.status}.`},{status:409})
    if(snapshot.run.status==='READING_JDS') return NextResponse.json({mode:'persistent',run:snapshot.run,complete:true,progress:{discovered:snapshot.candidates.length}})

    const known=snapshot.candidates.map(candidateFromRow)
    const result=await runDiscoveryBatch({freshnessDays:snapshot.run.freshness_days,unionSearchPlan:snapshot.run.union_search_plan,state:snapshot.run.discovery_state,knownCandidates:known,fetcher,maxRequests:8})
    await upsertPersistentCandidates({supabase,runId,candidates:result.candidates})
    const coverage={status:result.accessLimited?'ACCESS LIMITED':result.complete?'SEARCHED':'SEARCHING',detail:result.coverage?.detail||null}
    const run=await updatePersistentSearchRun({supabase,userId:auth.user.id,runId,patch:{status:result.complete?'READING_JDS':'DISCOVERING',discovery_state:result.state,stats:{...(snapshot.run.stats||{}),discovered:result.candidates.length},coverage}})
    return NextResponse.json({mode:'persistent',run,complete:result.complete,progress:{discovered:result.candidates.length}})
  }catch(error){
    console.error('Search Run discovery error',error)
    return NextResponse.json({error:String(error?.message||'Search Run discovery failed')},{status:502})
  }
}
