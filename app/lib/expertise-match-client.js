const text=value=>String(value??'').trim()

export async function requestExpertiseMatch({job,cvText,fetchImpl=fetch}={}){
  const payload={
    job:{
      title:text(job?.title),
      company:text(job?.company),
      location:text(job?.location),
      description:text(job?.description)
    },
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
