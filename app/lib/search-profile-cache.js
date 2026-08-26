import {SEARCH_PROFILE_BUILDER_VERSION} from './search-profile-ai.js'

const PREFIX='applypilot-search-profile'
const text=value=>String(value??'').trim()

export function searchProfileCacheKey(sourceVersion){
  const version=text(sourceVersion)
  if(!version) return ''
  return `${PREFIX}:${SEARCH_PROFILE_BUILDER_VERSION}:${encodeURIComponent(version)}`
}

export function readSearchProfileCache({storage,sourceVersion}={}){
  const key=searchProfileCacheKey(sourceVersion)
  if(!storage||!key) return null
  try{
    const raw=storage.getItem(key)
    if(!raw) return null
    const parsed=JSON.parse(raw)
    const roles=parsed?.roles
    return roles&&Array.isArray(roles.primaryRoles)&&Array.isArray(roles.adjacentRoles)?roles:null
  }catch{return null}
}

export function writeSearchProfileCache({storage,sourceVersion,roles}={}){
  const key=searchProfileCacheKey(sourceVersion)
  if(!storage||!key||!roles||!Array.isArray(roles.primaryRoles)||!Array.isArray(roles.adjacentRoles)) return false
  try{
    storage.setItem(key,JSON.stringify({roles,savedAt:new Date().toISOString()}))
    return true
  }catch{return false}
}
