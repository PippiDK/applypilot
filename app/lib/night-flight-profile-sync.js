import {createHash} from 'node:crypto'

function jsonObject(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return {}
  try{return JSON.parse(JSON.stringify(value))}catch{return {}}
}

function stableValue(value){
  if(Array.isArray(value)) return value.map(stableValue)
  if(value&&typeof value==='object'){
    return Object.keys(value).sort().reduce((out,key)=>{
      const next=value[key]
      if(next!==undefined) out[key]=stableValue(next)
      return out
    },{})
  }
  return value
}

function stableJson(value){return JSON.stringify(stableValue(value))}

export function buildNightFlightProfileState({searchProfile,cv}={}){
  const normalizedProfile=jsonObject(searchProfile)
  const cv_text=String(cv?.cvText??'')
  const cv_source_version=String(cv?.sourceVersion??'')
  const profile_fingerprint=createHash('sha256').update(stableJson({search_profile:normalizedProfile,cv_text,cv_source_version})).digest('hex')
  const synced_at=new Date().toISOString()
  return {
    search_profile:normalizedProfile,
    cv_text,
    cv_source_version,
    profile_fingerprint,
    synced_at,
    updated_at:synced_at,
  }
}
