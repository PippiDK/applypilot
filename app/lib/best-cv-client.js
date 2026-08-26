const text=value=>String(value??'').trim()

export async function requestBestCv({job,cvs,fetchImpl=fetch}={}){
  const candidates=(Array.isArray(cvs)?cvs:[]).filter(Boolean).map(cv=>({
    id:text(cv.id),
    slot:Number(cv.slot),
    fileName:text(cv.fileName),
    sourceVersion:text(cv.sourceVersion),
    cvText:text(cv.cvText),
    summary:text(cv.summary),
    skills:Array.isArray(cv.skills)?cv.skills.map(text).filter(Boolean):[]
  }))
  const payload={
    job:{
      sourceJobId:text(job?.sourceJobId),
      title:text(job?.title),
      company:text(job?.company),
      location:text(job?.location),
      description:text(job?.description)
    },
    cvs:candidates
  }
  const res=await fetchImpl('/api/best-cv',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  })
  const data=await res.json()
  if(!res.ok) throw new Error(data?.error||'Best CV analysis failed safely. Please try again.')
  return data.analysis
}
