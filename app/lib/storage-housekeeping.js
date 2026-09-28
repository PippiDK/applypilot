import {clearObsoleteLinkedInMasterPools} from './linkedin-master-pool-cache.js'

export const SEARCH_PROFILE_STORAGE_KEY='applypilot-profile'

const DISPOSABLE_PREFIXES=[
  'applypilot-search-profile:',
  'applypilot-search-profile-exclusions:',
  'applypilot-expertise-match:v3:',
]

function storageKeys(storage){
  if(!storage||typeof storage.key!=='function'||!Number.isFinite(Number(storage.length))) return []
  const keys=[]
  for(let index=0;index<Number(storage.length);index++){
    const key=storage.key(index)
    if(typeof key==='string') keys.push(key)
  }
  return keys
}

export function isStorageQuotaError(error){
  const name=String(error?.name||'')
  const message=String(error?.message||'')
  return name==='QuotaExceededError'||Number(error?.code)===22||/quota/i.test(message)
}

export function clearDisposableSearchCaches({storage}={}){
  let removed=clearObsoleteLinkedInMasterPools({storage})
  for(const key of storageKeys(storage)){
    if(!DISPOSABLE_PREFIXES.some(prefix=>key.startsWith(prefix))) continue
    try{
      storage.removeItem(key)
      removed++
    }catch{}
  }
  return removed
}

export function writeSearchProfileStorage({storage,profile,keepMasterPoolFingerprint=''}={}){
  if(!storage) throw new Error('Search Profile storage is unavailable.')
  const serialized=JSON.stringify(profile??{})
  clearObsoleteLinkedInMasterPools({storage,keepFingerprint:keepMasterPoolFingerprint})
  try{
    storage.setItem(SEARCH_PROFILE_STORAGE_KEY,serialized)
    return {recovered:false}
  }catch(error){
    if(!isStorageQuotaError(error)) throw error
    clearDisposableSearchCaches({storage})
    storage.setItem(SEARCH_PROFILE_STORAGE_KEY,serialized)
    return {recovered:true}
  }
}
