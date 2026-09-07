const text=value=>String(value??'').trim()

function compactIdentity(job={}){
  return Object.fromEntries(Object.entries({
    source:text(job.source),
    sourceJobId:text(job.sourceJobId),
    jobId:text(job.jobId),
    publishedAt:text(job.publishedAt),
    postedDate:text(job.postedDate),
    datePosted:text(job.datePosted),
  }).filter(([,value])=>value))
}

export async function requestExpertiseMatch({job,cvText,fetchImpl=fetch}={}){
  const payload={
    job:{
      title:text(job?.title),
      company:text(job?.company),
      location:text(job?.location),
      description:text(job?.description)
    },
    jobIdentity:compactIdentity(job),
    cvText:text(cvText)
  }
  const res=await fetchImpl('/api/expertise-match',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  })
  const data=await res.json()
  if(!res.ok) throw new Error(data?.error||'Expertise Match analysis failed safely. Please try again.')
  return data.analysis
}
