import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'
import {normalizeAppliedJobs} from '../../lib/applied-jobs.js'
import {APPLIED_JOBS_PREVIEW_USER_ID} from '../../lib/applied-jobs-preview.js'
import {loadAppliedJobsFromSupabase,upsertAppliedJobsToSupabase} from '../../lib/applied-jobs-supabase-store.js'

export const dynamic='force-dynamic'

async function appliedJobsUserId(){
  if(process.env.VERCEL_ENV==='preview') return {userId:APPLIED_JOBS_PREVIEW_USER_ID,response:null}

  const auth=await requireUser()
  if(!auth.user) return {userId:null,response:auth.response}
  return {userId:auth.user.id,response:null}
}

export async function GET(){
  const access=await appliedJobsUserId()
  if(!access.userId) return access.response
  try{
    const supabase=await createServerSupabaseClient()
    const jobs=await loadAppliedJobsFromSupabase({supabase,userId:access.userId})
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

  const access=await appliedJobsUserId()
  if(!access.userId) return access.response
  try{
    const supabase=await createServerSupabaseClient()
    await upsertAppliedJobsToSupabase({supabase,userId:access.userId,jobs})
    const stored=await loadAppliedJobsFromSupabase({supabase,userId:access.userId})
    return NextResponse.json({jobs:stored})
  }catch(error){
    console.error('applied-jobs save error',{message:error?.message||'unknown'})
    return NextResponse.json({error:'Applied jobs storage unavailable'},{status:500})
  }
}
