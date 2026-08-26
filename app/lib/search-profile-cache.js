import {SEARCH_PROFILE_BUILDER_VERSION,SEARCH_PROFILE_EXCLUSIONS_VERSION} from './search-profile-ai.js'

export {SEARCH_PROFILE_BUILDER_VERSION}

const PREFIX='applypilot-search-profile'
const EXCLUSIONS_PREFIX='applypilot-search-profile-exclusions'
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

export function normalizeExclusionsText(value=''){
  return String(value??'').replace(/\s+/g,' ').trim()
}

function hashText(value=''){
  let hash=2166136261
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i)
    hash=Math.imul(hash,16777619)
  }
  return (hash>>>0).toString(36)
}

export function searchProfileExclusionsFingerprint(exclusionsText=''){
  const source=normalizeExclusionsText(exclusionsText)
  return `${SEARCH_PROFILE_EXCLUSIONS_VERSION}:${hashText(source)}:${source.length}`
}

export function searchProfileExclusionsCacheKey(exclusionsText=''){
  const source=normalizeExclusionsText(exclusionsText)
  if(!source) return ''
  return `${EXCLUSIONS_PREFIX}:${searchProfileExclusionsFingerprint(source)}`
}

function validRules(value){return Array.isArray(value)&&value.every(rule=>rule&&typeof rule==='object'&&!Array.isArray(rule))}

export function readSearchProfileExclusionsCache({storage,exclusionsText}={}){
  const source=normalizeExclusionsText(exclusionsText)
  const key=searchProfileExclusionsCacheKey(source)
  if(!storage||!key) return null
  try{
    const raw=storage.getItem(key)
    if(!raw) return null
    const parsed=JSON.parse(raw)
    if(normalizeExclusionsText(parsed?.source)!==source||!validRules(parsed?.rules)) return null
    return {rules:parsed.rules}
  }catch{return null}
}

export function writeSearchProfileExclusionsCache({storage,exclusionsText,rules}={}){
  const source=normalizeExclusionsText(exclusionsText)
  const key=searchProfileExclusionsCacheKey(source)
  if(!storage||!key||!validRules(rules)) return false
  try{
    storage.setItem(key,JSON.stringify({source,rules,savedAt:new Date().toISOString()}))
    return true
  }catch{return false}
}

export async function resolveSearchProfileExclusions({storage,exclusionsText,savedProfile,parse}={}){
  const sourceText=normalizeExclusionsText(exclusionsText)
  const fingerprint=searchProfileExclusionsFingerprint(sourceText)
  if(!sourceText) return {rules:[],fingerprint,parserVersion:SEARCH_PROFILE_EXCLUSIONS_VERSION,source:'empty'}

  if(
    savedProfile?.exclusionsParserVersion===SEARCH_PROFILE_EXCLUSIONS_VERSION&&
    savedProfile?.exclusionsFingerprint===fingerprint&&
    normalizeExclusionsText(savedProfile?.exclusions)===sourceText&&
    validRules(savedProfile?.exclusionRules)
  ) return {rules:savedProfile.exclusionRules,fingerprint,parserVersion:SEARCH_PROFILE_EXCLUSIONS_VERSION,source:'profile'}

  const cached=readSearchProfileExclusionsCache({storage,exclusionsText:sourceText})
  if(cached) return {rules:cached.rules,fingerprint,parserVersion:SEARCH_PROFILE_EXCLUSIONS_VERSION,source:'cache'}

  if(typeof parse!=='function') throw new Error('Exclusions parser is required.')
  const parsed=await parse({exclusionsText:sourceText})
  const rules=parsed?.rules
  if(!validRules(rules)) throw new Error('Structured exclusions are invalid.')
  writeSearchProfileExclusionsCache({storage,exclusionsText:sourceText,rules})
  return {rules,fingerprint,parserVersion:SEARCH_PROFILE_EXCLUSIONS_VERSION,source:'ai'}
}
