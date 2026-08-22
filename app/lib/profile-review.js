export const DEFAULT_PROFILE={
  cvName:'',
  roles:'Senior Project Manager, Delivery Manager, Technical Project Manager, Program Manager',
  geography:['Denmark hybrid','Remote EU/EMEA'],
  salary:'75000',
  exclusions:'Construction; industrial hardware / manufacturing R&D; coordinator or assistant roles; mandatory Danish',
  savedAt:'',
  factBank:[],
  skills:[],
  cvParsedAt:''
}

const REVIEW_VOCAB=[
  'delivery','software','platform','project','program','programme','implementation','integration','transformation',
  'fintech','banking','regulatory','compliance','risk','governance','stakeholder','release','cutover','uat','agile',
  'azure','data','engineering','migration','cloud'
]

export function mergeProfile(saved={}){
  const value=saved&&typeof saved==='object'?saved:{}
  return {
    ...DEFAULT_PROFILE,
    ...value,
    geography:Array.isArray(value.geography)?value.geography:[...DEFAULT_PROFILE.geography],
    factBank:Array.isArray(value.factBank)?value.factBank:[],
    skills:Array.isArray(value.skills)?value.skills:[]
  }
}

export function resumeToProfile(profile,cvData){
  const base=mergeProfile(profile)
  if(!cvData) return base
  return {
    ...base,
    cvName:cvData.fileName||'',
    factBank:Array.isArray(cvData.facts)?cvData.facts:[],
    skills:Array.isArray(cvData.skills)?cvData.skills:[],
    cvParsedAt:cvData.parsedAt||''
  }
}

function cleanSource(text=''){
  return String(text).replace(/^[•\-–—▪◦*]+\s*/,'').replace(/\s+/g,' ').trim()
}

function isCompleteEvidence(text=''){
  const t=cleanSource(text)
  if(t.length<42||t.length>360) return false
  if(/\b(and|with|a|an|the|to|for|of|in|across|through|including)\s*[,;:]?$/i.test(t)) return false
  return /\b(led|managed|delivered|owned|drove|implemented|built|launched|improved|reduced|created|supported|developed|oversaw|planned|executed|established|introduced|collaborated|experience|experienced|worked|responsible)\b/i.test(t)
}

function jobText(item){
  const job=item?.job||{}
  return [job.title,job.description,job.jd].filter(Boolean).join(' ')
}

export function deriveReviewTerms(item){
  const lower=jobText(item).toLowerCase()
  return REVIEW_VOCAB.filter(term=>new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(lower))
}

function relevance(fact,terms){
  const t=cleanSource(fact?.text).toLowerCase()
  const matches=terms.reduce((n,term)=>n+(t.includes(term.toLowerCase())?2:0),0)
  return matches+(/\b(managed|led|delivered|owned|drove|implemented)\b/i.test(t)?1:0)
}

function topEvidence(facts,item){
  const verified=(Array.isArray(facts)?facts:[]).filter(f=>f&&f.verified!==false&&cleanSource(f.text))
  const complete=verified.filter(f=>isCompleteEvidence(f.text))
  const pool=complete.length>=3?complete:verified.filter(f=>cleanSource(f.text).length>35)
  const terms=deriveReviewTerms(item)
  return [...pool].map(f=>({...f,rel:relevance(f,terms)})).sort((a,b)=>b.rel-a.rel).slice(0,6)
}

function conservativeRewrite(text=''){
  let out=cleanSource(text)
  if(!out) return out
  out=out
    .replace(/\bLed the delivery of\b/i,'Led delivery of')
    .replace(/\bworked closely with\b/ig,'collaborated with')
    .replace(/\bhelping to maintain\b/ig,'supporting')
    .replace(/\bhelping maintain\b/ig,'supporting')
    .replace(/\bin order to\b/ig,'to')
    .replace(/\s+,/g,',')
  if(!/[.!?]$/.test(out)) out+='.'
  return out
}

function matchedTerms(text,terms){
  const lower=String(text).toLowerCase()
  return terms.filter(term=>lower.includes(term.toLowerCase()))
}

export function buildReviewChanges(facts,item){
  const terms=deriveReviewTerms(item)
  return topEvidence(facts,item).map((fact,index)=>{
    const original=cleanSource(fact.text)
    const updated=conservativeRewrite(original)
    const aligned=matchedTerms(original,terms)
    const originalSentence=`${original}${/[.!?]$/.test(original)?'':'.'}`
    const changed=updated!==originalSentence
    let why='Keeps verified experience intact while making the wording cleaner for this role.'
    if(aligned.length) why=`Keeps the verified experience intact and brings ${aligned.slice(0,3).join(', ')} wording into clearer focus for this role.`
    if(!changed) why=aligned.length?`Already strongly aligned with this role through ${aligned.slice(0,3).join(', ')}; no factual expansion is needed.`:'Already clear and evidence-based; no factual expansion is needed.'
    return {id:fact.id,original,updated,why,terms:aligned,changed,rank:index}
  }).filter(change=>change.changed)
}

export function applicationPackState(cvData){
  const facts=Array.isArray(cvData?.facts)?cvData.facts:[]
  const cvReady=facts.some(f=>f&&f.verified!==false&&cleanSource(f.text))
  return {
    cvReady,
    tailoredCvLabel:cvReady?'Ready for review':'Needs CV analysis',
    coverLetterLabel:'Not generated yet'
  }
}
