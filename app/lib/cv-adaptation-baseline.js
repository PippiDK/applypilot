import {isSourceCvReady} from './source-cv.js'

const text=value=>String(value??'').trim()

function jobId(job={}){
  const sourceJobId=text(job?.sourceJobId)
  if(sourceJobId) return sourceJobId
  const title=text(job?.title)
  const company=text(job?.company)
  return title&&company?`${title}|${company}`:''
}

function fingerprint(value=''){
  const normalized=String(value??'').replace(/\s+/g,' ').trim()
  let hash=2166136261
  for(let index=0;index<normalized.length;index++){
    hash^=normalized.charCodeAt(index)
    hash=Math.imul(hash,16777619)
  }
  return `jd-${(hash>>>0).toString(16).padStart(8,'0')}`
}

function cloneValue(value){
  if(Array.isArray(value)) return value.map(cloneValue)
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cloneValue(item)]))
  return value
}

function cvId(cv={}){
  const explicit=text(cv?.id)
  if(explicit) return explicit
  const slot=Number(cv?.slot)
  return Number.isInteger(slot)&&slot>0?`cv-${slot}`:''
}

export function buildAdaptationBaseline({job,cv}={}){
  const id=jobId(job)
  const description=text(job?.description||job?.jd)
  if(!id||!description) throw new Error('A valid vacancy with a usable job description is required for adaptation.')
  if(!isSourceCvReady(cv)) throw new Error('A ready CV is required for adaptation.')

  const selectedCvId=cvId(cv)
  if(!selectedCvId) throw new Error('A ready CV with a stable CV ID is required for adaptation.')

  return {
    jobId:id,
    jobTitle:text(job?.title),
    jobCompany:text(job?.company),
    jdFingerprint:fingerprint(description),
    cvId:selectedCvId,
    cvSlot:Number(cv?.slot)||null,
    fileName:text(cv?.fileName),
    sourceVersion:text(cv?.sourceVersion),
    cvText:text(cv?.cvText),
    summary:text(cv?.summary),
    facts:cloneValue(Array.isArray(cv?.facts)?cv.facts:[]),
    skills:cloneValue(Array.isArray(cv?.skills)?cv.skills:[]),
    createdAt:new Date().toISOString()
  }
}

export function baselineKey(baseline){
  if(!baseline||typeof baseline!=='object') return ''
  const parts=[baseline.jobId,baseline.jdFingerprint,baseline.cvId,baseline.sourceVersion].map(text)
  return parts.every(Boolean)?parts.map(encodeURIComponent).join('|'):''
}

export function baselineMatches({baseline,job,cv}={}){
  if(!baseline||typeof baseline!=='object'||!isSourceCvReady(cv)) return false
  const id=jobId(job)
  const description=text(job?.description||job?.jd)
  const selectedCvId=cvId(cv)
  if(!id||!description||!selectedCvId) return false
  return text(baseline.jobId)===id
    && text(baseline.jdFingerprint)===fingerprint(description)
    && text(baseline.cvId)===selectedCvId
    && text(baseline.sourceVersion)===text(cv?.sourceVersion)
}
