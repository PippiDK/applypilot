import {normalizeAppliedJobs} from './applied-jobs.js'

const rowFromJob=(userId,job)=>({
  user_id:userId,
  job_id:job.jobId,
  title:job.title,
  company:job.company,
  location:job.location,
  source:job.source,
  original_url:job.originalUrl,
  published_at:job.publishedAt,
  applied_at:job.appliedAt,
  relevance_score:job.relevanceScore,
})

const jobFromRow=row=>({
  jobId:row.job_id,
  title:row.title,
  company:row.company,
  location:row.location,
  source:row.source,
  originalUrl:row.original_url,
  publishedAt:row.published_at,
  appliedAt:row.applied_at,
  relevanceScore:row.relevance_score,
})

export async function upsertAppliedJobsToSupabase({supabase,userId,jobs=[]}={}){
  const normalized=normalizeAppliedJobs(jobs)
  if(!supabase||!userId||!normalized.length) return normalized
  const {error}=await supabase
    .from('applied_jobs')
    .upsert(normalized.map(job=>rowFromJob(userId,job)),{onConflict:'user_id,job_id'})
  if(error) throw error
  return normalized
}

export async function loadAppliedJobsFromSupabase({supabase,userId}={}){
  if(!supabase||!userId) return []
  const {data,error}=await supabase
    .from('applied_jobs')
    .select('user_id,job_id,title,company,location,source,original_url,published_at,applied_at,relevance_score')
    .eq('user_id',userId)
    .order('applied_at',{ascending:false})
  if(error) throw error
  return normalizeAppliedJobs((data||[]).map(jobFromRow))
}

export async function removeAppliedJobFromSupabase({supabase,userId,jobId}={}){
  const id=String(jobId??'').trim()
  if(!supabase||!userId||!id) throw new Error('Applied History deletion requires an authenticated user and job ID')
  const {error}=await supabase
    .from('applied_jobs')
    .delete()
    .eq('user_id',userId)
    .eq('job_id',id)
  if(error) throw error
  return true
}
