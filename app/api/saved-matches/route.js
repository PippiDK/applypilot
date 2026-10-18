import {NextResponse} from 'next/server'
import {requireUser} from '../../lib/auth/require-user.js'
import {createServerSupabaseClient} from '../../lib/supabase/server.js'

export const dynamic='force-dynamic'
export const runtime='nodejs'

// P2 only: write already-matched results. No reads, merging, or cleanup yet.
export async function POST(request){
  // Preview auth has a synthetic user ID: never write it to an authenticated DB table.
  if(process.env.VERCEL_ENV==='preview') return NextResponse.json({error:'Saved Matches preview persistence is not configured'},{status:503})
  const auth=await requireUser()
  if(!auth.user) return auth.response
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
      user_id:auth.user.id,
      source,job_id:jobId,published_at:publishedAt.toISOString(),
      profile_key:body.profileKey.trim(),job,evaluation,
      updated_at:new Date().toISOString()
    })
  }
  if(!rows.length) return NextResponse.json({saved:0})
  // Dedupe within the request as well as in the table.
  const byKey=new Map(rows.map(row=>[row.source+'|'+row.job_id,row]))
  const supabase=await createServerSupabaseClient()
  const {error}=await supabase.from('saved_matches').upsert([...byKey.values()],{onConflict:'user_id,source,job_id'})
  if(error){
    console.error('saved-matches write error',{code:error.code,message:error.message})
    return NextResponse.json({error:'Saved Matches storage unavailable'},{status:500})
  }
  return NextResponse.json({saved:byKey.size})
}
