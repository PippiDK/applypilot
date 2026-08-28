const text=value=>String(value??'').trim()
const raw=value=>String(value??'')

function jobKey(job={}){
  const sourceJobId=text(job?.sourceJobId)
  if(sourceJobId) return sourceJobId
  const title=text(job?.title)
  const company=text(job?.company)
  return title&&company?`${title}|${company}`:''
}

export function buildAdaptationInput({baseline,job}={}){
  if(!baseline||typeof baseline!=='object') throw new Error('A vacancy baseline is required before adaptation.')
  const currentJobKey=jobKey(job)
  if(!currentJobKey||currentJobKey!==text(baseline.jobId)) throw new Error('The selected CV baseline does not belong to this vacancy.')

  const cvId=text(baseline.cvId)
  const sourceVersion=text(baseline.sourceVersion)
  const fileName=text(baseline.fileName)
  const cvText=raw(baseline.cvText)
  const description=text(job?.description)
  if(!cvId||!sourceVersion||!fileName||cvText.trim().length<100) throw new Error('The selected CV baseline is incomplete.')
  if(!text(job?.title)||description.length<80) throw new Error('A usable vacancy is required for adaptation.')

  return {
    sourceCv:{cvId,sourceVersion,fileName,cvText},
    job:{
      sourceJobId:text(job?.sourceJobId)||currentJobKey,
      title:text(job?.title),
      company:text(job?.company),
      location:text(job?.location),
      description
    }
  }
}
