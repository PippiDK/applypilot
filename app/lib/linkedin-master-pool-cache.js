export const LINKEDIN_MASTER_POOL_STORAGE_PREFIX='applypilot-linkedin-master-pool-v1'

const text=value=>String(value??'').trim()

export function masterPoolStorageKey(fingerprint=''){
  const key=text(fingerprint)
  return key?LINKEDIN_MASTER_POOL_STORAGE_PREFIX+':'+key:''
}

export function readLinkedInMasterPool({storage,fingerprint}={}){
  const key=masterPoolStorageKey(fingerprint)
  if(!storage||!key) return []
  try{
    const raw=storage.getItem(key)
    const parsed=raw?JSON.parse(raw):null
    return Array.isArray(parsed?.candidates)?parsed.candidates:[]
  }catch{return []}
}

export function writeLinkedInMasterPool({storage,fingerprint,candidates=[]}={}){
  const key=masterPoolStorageKey(fingerprint)
  if(!storage||!key) return []
  const safe=Array.isArray(candidates)?candidates.slice(0,500):[]
  storage.setItem(key,JSON.stringify({version:1,candidates:safe,savedAt:new Date().toISOString()}))
  return safe
}
