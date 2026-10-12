export const LINKEDIN_MASTER_POOL_STORAGE_PREFIX='applypilot-linkedin-master-pool-v1'
export const LINKEDIN_CACHE_VIEW_MAX_AGE_MS=15*60*1000
export const LINKEDIN_MASTER_POOL_RETENTION_DAYS=10

const DAY_MS=86400000
const text=value=>String(value??'').trim()

export function masterPoolStorageKey(fingerprint=''){
  const key=text(fingerprint)
  return key?LINKEDIN_MASTER_POOL_STORAGE_PREFIX+':'+key:''
}

function storageKeys(storage){
  if(!storage||typeof storage.key!=='function'||!Number.isFinite(Number(storage.length))) return []
  const keys=[]
  for(let index=0;index<Number(storage.length);index++){
    const key=storage.key(index)
    if(typeof key==='string') keys.push(key)
  }
  return keys
}

function publishedAt(value={}){
  return value?.publishedAt||value?.postedDate||null
}

export function isWithinLinkedInMasterPoolRetention(value,now=new Date()){
  const current=now instanceof Date?now:new Date(now)
  const published=new Date(publishedAt(value)||value||0)
  if(!Number.isFinite(current.getTime())||!Number.isFinite(published.getTime())) return false
  const age=current.getTime()-published.getTime()
  return age>=0&&age<=LINKEDIN_MASTER_POOL_RETENTION_DAYS*DAY_MS
}

function rollingSnapshot({candidates=[],verifiedJobs=[],savedAt=null,now=new Date()}={}){
  const retainedVerifiedJobs=(Array.isArray(verifiedJobs)?verifiedJobs:[])
    .filter(job=>isWithinLinkedInMasterPoolRetention(job,now))
  const retainedVerifiedIds=new Set(retainedVerifiedJobs.map(job=>text(job?.sourceJobId||job?.jobId)).filter(Boolean))
  const retainedCandidates=(Array.isArray(candidates)?candidates:[])
    .filter(candidate=>{
      if(isWithinLinkedInMasterPoolRetention(candidate,now)) return true
      const id=text(candidate?.jobId||candidate?.sourceJobId)
      return Boolean(id&&retainedVerifiedIds.has(id))
    })
  return {candidates:retainedCandidates,verifiedJobs:retainedVerifiedJobs,savedAt}
}

export function clearObsoleteLinkedInMasterPools({storage,keepFingerprint=''}={}){
  const keepKey=masterPoolStorageKey(keepFingerprint)
  let removed=0
  for(const key of storageKeys(storage)){
    if(!key.startsWith(LINKEDIN_MASTER_POOL_STORAGE_PREFIX+':')||key===keepKey) continue
    try{
      storage.removeItem(key)
      removed++
    }catch{}
  }
  return removed
}

export function readLinkedInMasterPoolSnapshot({storage,fingerprint,now=new Date()}={}){
  const key=masterPoolStorageKey(fingerprint)
  if(!storage||!key) return {candidates:[],verifiedJobs:[],savedAt:null}
  try{
    const raw=storage.getItem(key)
    const parsed=raw?JSON.parse(raw):null
    return rollingSnapshot({
      candidates:Array.isArray(parsed?.candidates)?parsed.candidates:[],
      verifiedJobs:Array.isArray(parsed?.verifiedJobs)?parsed.verifiedJobs:[],
      savedAt:typeof parsed?.savedAt==='string'?parsed.savedAt:null,
      now,
    })
  }catch{return {candidates:[],verifiedJobs:[],savedAt:null}}
}

export function readLinkedInMasterPool(options={}){
  return readLinkedInMasterPoolSnapshot(options).candidates
}

export function isLinkedInMasterPoolFresh(snapshot={},now=new Date(),maxAgeMs=LINKEDIN_CACHE_VIEW_MAX_AGE_MS){
  const saved=new Date(snapshot?.savedAt||0)
  if(!Number.isFinite(saved.getTime())) return false
  const age=now.getTime()-saved.getTime()
  return age>=0&&age<=Math.max(0,Number(maxAgeMs)||0)
}

export function writeLinkedInMasterPool({storage,fingerprint,candidates=[],verifiedJobs=[],now=new Date()}={}){
  const key=masterPoolStorageKey(fingerprint)
  if(!storage||!key) return {candidates:[],verifiedJobs:[],savedAt:null}
  clearObsoleteLinkedInMasterPools({storage,keepFingerprint:fingerprint})
  const savedAt=(now instanceof Date?now:new Date(now)).toISOString()
  const retained=rollingSnapshot({candidates,verifiedJobs,savedAt,now})
  try{
    storage.setItem(key,JSON.stringify({version:3,...retained}))
  }catch{}
  return retained
}
