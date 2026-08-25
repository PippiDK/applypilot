const PREFIX='applypilot-job-analysis:v1'

const text=value=>String(value??'').trim()

export function jobAnalysisCacheKey(jobId,sourceVersion){
  const job=text(jobId), version=text(sourceVersion)
  if(!job||!version) return ''
  return `${PREFIX}:${encodeURIComponent(job)}:${encodeURIComponent(version)}`
}

export function readJobAnalysisCache({storage,jobId,sourceVersion}={}){
  const key=jobAnalysisCacheKey(jobId,sourceVersion)
  if(!storage||!key) return null
  try{
    const raw=storage.getItem(key)
    if(!raw) return null
    const parsed=JSON.parse(raw)
    return parsed?.analysis&&typeof parsed.analysis==='object'
      ? {analysis:parsed.analysis,token:String(parsed.token||'')}
      : null
  }catch{return null}
}

export function writeJobAnalysisCache({storage,jobId,sourceVersion,analysis,token=''}={}){
  const key=jobAnalysisCacheKey(jobId,sourceVersion)
  if(!storage||!key||!analysis||typeof analysis!=='object') return false
  try{
    storage.setItem(key,JSON.stringify({analysis,token:String(token||''),savedAt:new Date().toISOString()}))
    return true
  }catch{return false}
}
