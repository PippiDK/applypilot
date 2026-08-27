import {NextResponse} from 'next/server'
import {requireUser} from '../../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../../lib/supabase/server.js'
import {createLinkedInStableFetcher} from '../../../lib/linkedin-stable-fetcher.js'
import {runProfileJdBatch} from '../../../lib/linkedin-profile-jd-batch.js'
import {loadPersistentSearchRun,loadPendingPersistentCandidates,saveProcessedPersistentCandidates,updatePersistentSearchRun,composeSearchRunResult} from '../../../lib/search-run-store.js'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120

const isPreview=()=>process.env.VERCEL_ENV==='preview'
const asPending=candidates=>(Array.isArray(candidates)?candidates:[]).filter(row=>!row.detailStatus||row.detailStatus==='PENDING')

function mergePreviewCandidates(all=[],processed=[]){
  const byId=new Map((Array.isArray(all)?all:[]).map(row=>[String(row.jobId),row]))
  for(const row of processed){
    byId.set(String(row.candidate.jobId),{...row.candidate,detailStatus:row.detailStatus,job:row.job,evaluation:row.evaluation,audit:row.audit,error:row.error})
  }
  return [...byId.values()]
}

export async function POST(request){
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const body=await request.json().catch(()=>({}))
    const fetcher=createLinkedInStableFetcher({totalBudgetMs:90000})

    if(isPreview()){
      const run=body?.run||{}
      const all=Array.isArray(body?.candidates)?body.candidates:[]
      const pending=asPending(all)
      if(run.status!=='READING_JDS'&&pending.length) return NextResponse.json({error:`Search Run cannot process JDs from status ${run.status}.`},{status:409})
      const batch=await runProfileJdBatch({candidates:pending,fetcher,freshnessDays:run.freshness_days,exclusionRules:run.exclusion_rules,maxCandidates:16,safeBudgetMs:45000})
      const candidates=mergePreviewCandidates(all,batch.processed)
      const remaining=asPending(candidates).length
      const accessLimited=run.coverage?.status==='ACCESS LIMITED'||batch.accessLimited
      const status=remaining?'READING_JDS':accessLimited?'ACCESS_LIMITED':'COMPLETE'
      const processedCount=candidates.filter(row=>row.detailStatus==='PROCESSED'||row.detailStatus==='UNVERIFIED').length
      const verifiedCount=candidates.filter(row=>row.detailStatus==='PROCESSED').length
      const nextRun={...run,status,stats:{...(run.stats||{}),discovered:candidates.length,fullJdProcessed:processedCount,fullJdVerified:verifiedCount},coverage:{status:accessLimited?'ACCESS LIMITED':remaining?'SEARCHING':'SEARCHED',detail:run.coverage?.detail||null},updated_at:new Date().toISOString(),...(remaining?{}:{completed_at:new Date().toISOString()})}
      return NextResponse.json({mode:'preview',run:nextRun,candidates,batchJobs:batch.jobs,batchAudit:batch.processed.map(row=>({jobId:row.candidate.jobId,title:row.job?.title||row.candidate.title||'',company:row.job?.company||row.candidate.company||'',...row.audit})),complete:remaining===0,progress:{discovered:candidates.length,fullJdProcessed:processedCount,fullJdVerified:verifiedCount}})
    }

    const runId=String(body?.runId||'')
    if(!runId) return NextResponse.json({error:'Search Run id is required.'},{status:400})
    const supabase=await createServerSupabaseClient()
    const snapshot=await loadPersistentSearchRun({supabase,userId:auth.user.id,runId})
    if(!['READING_JDS'].includes(snapshot.run.status)){
      if(['COMPLETE','ACCESS_LIMITED'].includes(snapshot.run.status)) return NextResponse.json({mode:'persistent',run:snapshot.run,result:composeSearchRunResult(snapshot.run,snapshot.candidates),complete:true})
      return NextResponse.json({error:`Search Run cannot process JDs from status ${snapshot.run.status}.`},{status:409})
    }

    const pending=await loadPendingPersistentCandidates({supabase,runId,limit:16})
    if(!pending.length){
      const accessLimited=snapshot.run.coverage?.status==='ACCESS LIMITED'||snapshot.candidates.some(row=>row.detail_status==='UNVERIFIED')
      const status=accessLimited?'ACCESS_LIMITED':'COMPLETE'
      const run=await updatePersistentSearchRun({supabase,userId:auth.user.id,runId,patch:{status,completed_at:new Date().toISOString(),coverage:{...(snapshot.run.coverage||{}),status:accessLimited?'ACCESS LIMITED':'SEARCHED'}}})
      const finalSnapshot=await loadPersistentSearchRun({supabase,userId:auth.user.id,runId})
      return NextResponse.json({mode:'persistent',run,result:composeSearchRunResult(run,finalSnapshot.candidates),complete:true})
    }

    const batch=await runProfileJdBatch({candidates:pending,fetcher,freshnessDays:snapshot.run.freshness_days,exclusionRules:snapshot.run.exclusion_rules,maxCandidates:16,safeBudgetMs:45000})
    await saveProcessedPersistentCandidates({supabase,runId,processed:batch.processed})
    const after=await loadPersistentSearchRun({supabase,userId:auth.user.id,runId})
    const remaining=after.candidates.filter(row=>row.detail_status==='PENDING').length
    const processedCount=after.candidates.filter(row=>row.detail_status==='PROCESSED'||row.detail_status==='UNVERIFIED').length
    const verifiedCount=after.candidates.filter(row=>row.detail_status==='PROCESSED').length
    const accessLimited=snapshot.run.coverage?.status==='ACCESS LIMITED'||batch.accessLimited||after.candidates.some(row=>row.detail_status==='UNVERIFIED')
    const status=remaining?'READING_JDS':accessLimited?'ACCESS_LIMITED':'COMPLETE'
    const coverage={...(snapshot.run.coverage||{}),status:accessLimited?'ACCESS LIMITED':remaining?'SEARCHING':'SEARCHED'}
    const run=await updatePersistentSearchRun({supabase,userId:auth.user.id,runId,patch:{status,stats:{...(snapshot.run.stats||{}),discovered:after.candidates.length,fullJdProcessed:processedCount,fullJdVerified:verifiedCount},coverage,...(remaining?{}:{completed_at:new Date().toISOString()})}})
    const result=remaining?null:composeSearchRunResult(run,after.candidates)
    return NextResponse.json({mode:'persistent',run,batchJobs:batch.jobs,batchAudit:batch.processed.map(row=>({jobId:row.candidate.jobId,title:row.job?.title||row.candidate.title||'',company:row.job?.company||row.candidate.company||'',...row.audit})),result,complete:remaining===0,progress:{discovered:after.candidates.length,fullJdProcessed:processedCount,fullJdVerified:verifiedCount}})
  }catch(error){
    console.error('Search Run JD processing error',error)
    return NextResponse.json({error:String(error?.message||'Search Run JD processing failed')},{status:502})
  }
}
