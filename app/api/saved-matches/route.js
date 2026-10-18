import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'

export const dynamic='force-dynamic'
export const runtime='nodejs'

// P2 only: write already-matched results. No reads, merging, or cleanup yet.
export async function POST(request){
  // Preview's generic requireUser() has a synthetic identity. Saved Matches must
  // always use a real authenticated Supabase user so the database RLS applies.
  const supabase=await createServerSupabaseClient()
  let user
  if(process.env.VERCEL_ENV==='preview'){
    const {data,error}=await supabase.auth.getUser()
    if(error||!data?.user) return NextResponse.json({error:'Unauthorized'},{status:401})
    user=data.user
  }else{
    const auth=await requireUser()
    if(!auth.user) return auth.response
    user=auth.user
  }
  const body=await request.json().catch(()=>null)
  if(!body||typeof body.profileKey!=='string'||!body.profileKey.trim()||!Array.isArray(body.items)||body.items.length>500){
    return NextResponse.json({error:'Invalid Saved Matches payload'},{status:400})
  }
  const rows=[]
  for(const item of body.items){
    const job=item?.job
    const evaluation=item?.evaluation
    if(!job||!evaluation||typeof job!=='object'||typeof evaluation!=='object'||Array.isArray(job)||Array.isArray(evaluation)) continue
    const jobId=String(job.sourceJobId||'').trim()
    const source=String(job.source||'').trim().toLowerCase()
    const publishedAt=new Date(job.publishedAt||'')
    if(!jobId||!source||!Number.isFinite(publishedAt.getTime())) continue
    rows.push({
      user_id:user.id,
      source,job_id:jobId,published_at:publishedAt.toISOString(),
      profile_key:body.profileKey.trim(),job,evaluation,
      updated_at:new Date().toISOString()
    })
  }
  if(!rows.length) return NextResponse.json({saved:0})
  // Dedupe within the request as well as in the table.
  const byKey=new Map(rows.map(row=>[row.source+'|'+row.job_id,row]))
  const {error}=await supabase.from('saved_matches').upsert([...byKey.values()],{onConflict:'user_id,source,job_id'})
  if(error){
    console.error('saved-matches write error',{code:error.code,message:error.message})
    return NextResponse.json({error:'Saved Matches storage unavailable'},{status:500})
  }
  return NextResponse.json({saved:byKey.size})
}
