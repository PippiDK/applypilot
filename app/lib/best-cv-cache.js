const SELECTOR_VERSION='best-cv-selector-v1'
const PREFIX=`applypilot-best-cv:${SELECTOR_VERSION}`
const SELECTION_PREFIX=`applypilot-best-cv-selection:${SELECTOR_VERSION}`
const text=value=>String(value??'').trim()

function hash(value=''){
  let h=2166136261
  for(const ch of String(value)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619) }
  return (h>>>0).toString(36)
}

function candidateSignature(cvs=[]){
  return (Array.isArray(cvs)?cvs:[])
    .filter(Boolean)
    .map(cv=>`${text(cv.id)}:${text(cv.sourceVersion)}`)
    .filter(item=>!item.startsWith(':')&&!item.endsWith(':'))
    .sort()
    .join('|')
}

export function bestCvCacheKey({jobId,description,cvs=[]}={}){
  const job=text(jobId)
  const jd=text(description)
  const signature=candidateSignature(cvs)
  if(!job||!jd||!signature) return ''
  return `${PREFIX}:${encodeURIComponent(job)}:${hash(jd)}:${hash(signature)}`
}

export function readBestCvCache({storage,jobId,description,cvs=[]}={}){
  const key=bestCvCacheKey({jobId,description,cvs})
  if(!storage||!key) return null
  try{
    const raw=storage.getItem(key)
    if(!raw) return null
    const parsed=JSON.parse(raw)
    return parsed?.analysis&&typeof parsed.analysis==='object'?parsed.analysis:null
  }catch{return null}
}

export function writeBestCvCache({storage,jobId,description,cvs=[],analysis}={}){
  const key=bestCvCacheKey({jobId,description,cvs})
  if(!storage||!key||!analysis||typeof analysis!=='object') return false
  try{
    storage.setItem(key,JSON.stringify({analysis,savedAt:new Date().toISOString()}))
    return true
  }catch{return false}
}

function selectionKey(args){
  const key=bestCvCacheKey(args)
  return key?`${SELECTION_PREFIX}:${hash(key)}`:''
}

export function readBestCvSelection({storage,jobId,description,cvs=[]}={}){
  const key=selectionKey({jobId,description,cvs})
  if(!storage||!key) return null
  try{
    const raw=storage.getItem(key)
    if(!raw) return null
    const parsed=JSON.parse(raw)
    const current=(Array.isArray(cvs)?cvs:[]).find(cv=>cv?.id===parsed?.cvId&&cv?.sourceVersion===parsed?.sourceVersion)
    return current?{cvId:current.id,sourceVersion:current.sourceVersion}:null
  }catch{return null}
}

export function writeBestCvSelection({storage,jobId,description,cvs=[],cvId}={}){
  const key=selectionKey({jobId,description,cvs})
  const current=(Array.isArray(cvs)?cvs:[]).find(cv=>cv?.id===text(cvId))
  if(!storage||!key||!current?.sourceVersion) return false
  try{
    storage.setItem(key,JSON.stringify({cvId:current.id,sourceVersion:current.sourceVersion,savedAt:new Date().toISOString()}))
    return true
  }catch{return false}
}
