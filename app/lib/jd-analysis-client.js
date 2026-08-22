const text=value=>String(value??'').trim()

export async function requestJobAnalysis({sourceVersion,job,fetchImpl=fetch}){
  const res=await fetchImpl('/api/tailor-cv',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      action:'analyze_job',
      sourceVersion:text(sourceVersion),
      job:{
        title:text(job?.title),
        company:text(job?.company),
        location:text(job?.location),
        description:text(job?.description)
      }
    })
  })
  const data=await res.json()
  if(!res.ok) throw new Error(data?.error||'Job analysis failed safely. Please try again.')
  return data
}
