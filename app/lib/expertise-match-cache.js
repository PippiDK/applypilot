const PREFIX='applypilot-expertise-match:v2'

const text=value=>String(value??'').trim()

export function expertiseMatchCacheKey(jobId,sourceVersion){
  const job=text(jobId), version=text(sourceVersion)
  if(!job||!version) return ''
  return `${PREFIX}:${encodeURIComponent(job)}:${encodeURIComponent(version)}`
}

export function readExpertiseMatchCache({storage,jobId,sourceVersion}={}){
  const key=expertiseMatchCacheKey(jobId,sourceVersion)
  if(!storage||!key) return null
  try{
    const raw=storage.getItem(key)
    if(!raw) return null
    const parsed=JSON.parse(raw)
    return parsed?.analysis&&typeof parsed.analysis==='object'?parsed.analysis:null
  }catch{return null}
}

export function writeExpertiseMatchCache({storage,jobId,sourceVersion,analysis}={}){
  const key=expertiseMatchCacheKey(jobId,sourceVersion)
  if(!storage||!key||!analysis||typeof analysis!=='object') return false
  try{
    storage.setItem(key,JSON.stringify({analysis,savedAt:new Date().toISOString()}))
    return true
  }catch{return false}
}
