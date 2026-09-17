import {APPLIED_JOBS_STORAGE_KEY,normalizeAppliedJobs,readAppliedJobs} from './applied-jobs.js'

function resolveFetch(fetchImpl){
  const candidate=fetchImpl??globalThis.fetch
  if(typeof candidate!=='function') throw new Error('Applied History API is unavailable.')
  return candidate
}

async function responseJobs(response){
  let body={}
  try{body=await response.json()}catch{}
  if(!response?.ok) throw new Error(body?.error||'Applied History storage unavailable.')
  return normalizeAppliedJobs(body?.jobs)
}

export async function fetchAppliedJobs({fetchImpl}={}){
  const request=resolveFetch(fetchImpl)
  const response=await request('/api/applied-jobs',{method:'GET',cache:'no-store'})
  return responseJobs(response)
}

export async function persistAppliedJobs(jobs,{fetchImpl}={}){
  const request=resolveFetch(fetchImpl)
  const normalized=normalizeAppliedJobs(jobs)
  const response=await request('/api/applied-jobs',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({jobs:normalized}),
  })
  return responseJobs(response)
}

export async function loadAppliedJobs({storage,fetchImpl,bootstrapJobs}={}){
  const targetStorage=storage??(typeof window!=='undefined'?window.localStorage:null)
  const legacy=readAppliedJobs(targetStorage)

  let remote
  try{
    remote=Array.isArray(bootstrapJobs)
      ? normalizeAppliedJobs(bootstrapJobs)
      : await fetchAppliedJobs({fetchImpl})
  }catch(error){
    if(legacy.length) return legacy
    throw error
  }

  if(!legacy.length) return remote

  const merged=normalizeAppliedJobs([...remote,...legacy])
  const remoteIds=new Set(remote.map(job=>job.jobId))
  const needsMigration=legacy.some(job=>!remoteIds.has(job.jobId))

  if(!needsMigration){
    targetStorage?.removeItem?.(APPLIED_JOBS_STORAGE_KEY)
    return remote
  }

  try{
    const stored=await persistAppliedJobs(merged,{fetchImpl})
    targetStorage?.removeItem?.(APPLIED_JOBS_STORAGE_KEY)
    return stored
  }catch{
    return merged
  }
}
