import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'
import {normalizeAppliedJobs} from '../../lib/applied-jobs.js'
import {loadAppliedJobsFromSupabase,upsertAppliedJobsToSupabase} from '../../lib/applied-jobs-supabase-store.js'

export const dynamic='force-dynamic'

export async function GET(){
  if(process.env.VERCEL_ENV==='preview') return NextResponse.json({jobs:[]})
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const supabase=await createServerSupabaseClient()
    const jobs=await loadAppliedJobsFromSupabase({supabase,userId:auth.user.id})
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

  if(process.env.VERCEL_ENV==='preview') return NextResponse.json({jobs})
  const auth=await requireUser()
  if(!auth.user) return auth.response
  try{
    const supabase=await createServerSupabaseClient()
    await upsertAppliedJobsToSupabase({supabase,userId:auth.user.id,jobs})
    const stored=await loadAppliedJobsFromSupabase({supabase,userId:auth.user.id})
    return NextResponse.json({jobs:stored})
  }catch(error){
    console.error('applied-jobs save error',{message:error?.message||'unknown'})
    return NextResponse.json({error:'Applied jobs storage unavailable'},{status:500})
  }
}
