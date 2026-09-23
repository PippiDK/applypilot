import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'
import {normalizeAppliedJobs} from '../../lib/applied-jobs.js'
import {APPLIED_JOBS_PREVIEW_USER_ID,createPreviewAppliedJobsSupabaseClient} from '../../lib/applied-jobs-preview.js'
import {loadAppliedJobsFromSupabase,upsertAppliedJobsToSupabase,removeAppliedJobFromSupabase} from '../../lib/applied-jobs-supabase-store.js'

export const dynamic='force-dynamic'

async function appliedJobsContext(){
  if(process.env.VERCEL_ENV==='preview'){
    return {
      userId:APPLIED_JOBS_PREVIEW_USER_ID,
      supabase:createPreviewAppliedJobsSupabaseClient(),
      response:null,
    }
  }

  const auth=await requireUser()
  if(!auth.user) return {userId:null,supabase:null,response:auth.response}

  return {
    userId:auth.user.id,
    supabase:await createServerSupabaseClient(),
    response:null,
  }
}

export async function GET(){
  const context=await appliedJobsContext()
  if(!context.userId) return context.response
  try{
    const jobs=await loadAppliedJobsFromSupabase({supabase:context.supabase,userId:context.userId})
    return NextResponse.json({jobs})
  }catch(error){
    console.error('applied-jobs load error',{message:error?.message||'unknown'})
    return NextResponse.json({error:'Applied jobs storage unavailable'},{status:500})
  }
}

export async function POST(request){
  let jobs=[]
  try{jobs=normalizeAppliedJobs((await request.json())?.jobs)}
  catch{return NextResponse.json({error:'Invalid applied jobs payload'},{status:400})}

  const context=await appliedJobsContext()
  if(!context.userId) return context.response
  try{
    await upsertAppliedJobsToSupabase({supabase:context.supabase,userId:context.userId,jobs})
    const stored=await loadAppliedJobsFromSupabase({supabase:context.supabase,userId:context.userId})
    return NextResponse.json({jobs:stored})
  }catch(error){
    console.error('applied-jobs save error',{message:error?.message||'unknown'})
    return NextResponse.json({error:'Applied jobs storage unavailable'},{status:500})
  }
}

export async function DELETE(request){
  let jobId=''
  try{
    const body=await request.json()
    if(typeof body?.jobId==='string') jobId=body.jobId.trim()
  }catch{}
  if(!jobId) return NextResponse.json({error:'A valid job ID is required'},{status:400})

  const context=await appliedJobsContext()
  if(!context.userId) return context.response
  try{
    await removeAppliedJobFromSupabase({supabase:context.supabase,userId:context.userId,jobId})
    const stored=await loadAppliedJobsFromSupabase({supabase:context.supabase,userId:context.userId})
    return NextResponse.json({jobs:stored})
  }catch(error){
    console.error('applied-jobs delete error',{message:error?.message||'unknown'})
    return NextResponse.json({error:'Applied jobs storage unavailable'},{status:500})
  }
}
