export const LINKEDIN_MASTER_POOL_STORAGE_PREFIX='applypilot-linkedin-master-pool-v1'
export const LINKEDIN_CACHE_VIEW_MAX_AGE_MS=15*60*1000

const text=value=>String(value??'').trim()

export function masterPoolStorageKey(fingerprint=''){
  const key=text(fingerprint)
  return key?LINKEDIN_MASTER_POOL_STORAGE_PREFIX+':'+key:''
}

export function readLinkedInMasterPoolSnapshot({storage,fingerprint}={}){
  const key=masterPoolStorageKey(fingerprint)
  if(!storage||!key) return {candidates:[],verifiedJobs:[],savedAt:null}
  try{
    const raw=storage.getItem(key)
    const parsed=raw?JSON.parse(raw):null
    return {
      candidates:Array.isArray(parsed?.candidates)?parsed.candidates:[],
      verifiedJobs:Array.isArray(parsed?.verifiedJobs)?parsed.verifiedJobs:[],
      savedAt:typeof parsed?.savedAt==='string'?parsed.savedAt:null,
    }
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

export function writeLinkedInMasterPool({storage,fingerprint,candidates=[],verifiedJobs=[]}={}){
  const key=masterPoolStorageKey(fingerprint)
  if(!storage||!key) return {candidates:[],verifiedJobs:[],savedAt:null}
  const safeCandidates=Array.isArray(candidates)?candidates.slice(0,500):[]
  const safeVerifiedJobs=Array.isArray(verifiedJobs)?verifiedJobs.slice(0,500):[]
  const savedAt=new Date().toISOString()
  storage.setItem(key,JSON.stringify({version:2,candidates:safeCandidates,verifiedJobs:safeVerifiedJobs,savedAt}))
  return {candidates:safeCandidates,verifiedJobs:safeVerifiedJobs,savedAt}
}
