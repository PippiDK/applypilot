const text=value=>String(value??'').trim()

export async function requestCoverLetter({baseline,job,finalCvBlocks=[],languageMode='same_as_job',fetchImpl=fetch}={}){
  if(!baseline?.cvId||!baseline?.sourceVersion||!text(baseline?.cvText)) throw new Error('A complete selected CV is required for the cover letter.')
  const response=await fetchImpl('/api/cover-letter',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      job:{
        sourceJobId:text(job?.sourceJobId),
        title:text(job?.title),
        company:text(job?.company),
        location:text(job?.location),
        description:text(job?.description||job?.jd)
      },
      sourceCv:{
        cvId:text(baseline.cvId),
        sourceVersion:text(baseline.sourceVersion),
        fileName:text(baseline.fileName),
        cvText:String(baseline.cvText||'')
      },
      finalCvBlocks:Array.isArray(finalCvBlocks)?finalCvBlocks:[],
      languageMode:languageMode==='english'?'english':'same_as_job'
    })
  })
  const data=await response.json()
  if(!response.ok) throw new Error(data?.error||'Cover letter generation failed safely.')
  if(!text(data?.letter)) throw new Error('Cover letter generation returned no usable text.')
  return data
}
