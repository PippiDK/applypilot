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



const REQUIREMENT_CATALOG=[
  {
    id:'end_to_end',
    label:'End-to-end delivery',
    jd:[/end[- ]to[- ]end/i,/full lifecycle/i,/delivery lifecycle/i],
    evidence:[/end[- ]to[- ]end/i,/full lifecycle/i,/delivery lifecycle/i,/SIT/i,/SAT/i,/RFS/i,/go-live/i,/transition to operations/i]
  },
  {
    id:'distributed',
    label:'Distributed / international teams',
    jd:[/distributed/i,/international teams/i,/global teams/i,/across EMEA/i],
    evidence:[/distributed/i,/international (?:project |engineering )?teams/i,/Denmark.*India/i,/India.*Poland/i,/DK.*IN/i]
  },
  {
    id:'release',
    label:'Release readiness / go-live',
    jd:[/release readiness/i,/go-live/i,/production release/i,/release management/i],
    evidence:[/release readiness/i,/go-live/i,/RFS/i,/production/i,/transition to operations/i]
  },
  {
    id:'risk_dependency',
    label:'Risk & dependency management',
    jd:[/risk/i,/dependenc/i,/RAID/i],
    evidence:[/risk/i,/dependenc/i,/RAID/i]
  },
  {
    id:'integration',
    label:'Integration dependencies',
    jd:[/integration/i,/API/i,/interfaces/i],
    evidence:[/integration/i,/API/i,/interface/i]
  },
  {
    id:'governance',
    label:'Programme / delivery governance',
    jd:[/programme governance/i,/program governance/i,/delivery governance/i,/structured governance/i,/PMO/i],
    evidence:[/governance/i,/roadmap/i,/backlog governance/i,/PMO/i]
  },
  {
    id:'regulatory',
    label:'Regulatory / compliance delivery',
    jd:[/regulated/i,/regulatory/i,/compliance/i],
    evidence:[/regulated/i,/regulatory/i,/compliance/i,/AML/i]
  },
  {
    id:'agile',
    label:'Agile / hybrid delivery',
    jd:[/Agile/i,/hybrid delivery/i,/Scrum/i],
    evidence:[/Agile/i,/Hybrid/i,/Scrum/i,/SAFe/i]
  }
]
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



function matchesAny(text='',patterns=[]){
  return patterns.some(pattern=>pattern.test(String(text)))
}

function extractJobRequirements(item){
  const text=jobText(item)
  return REQUIREMENT_CATALOG.filter(req=>matchesAny(text,req.jd))
}

function requirementSupported(req,facts=[]){
  return (Array.isArray(facts)?facts:[]).some(fact=>fact&&fact.verified!==false&&matchesAny(cleanSource(fact.text),req.evidence))
}

function supportsDistributedRewrite(text=''){
  const value=cleanSource(text)
  if(/\bdistributed\b/i.test(value)) return true
  if(/\binternational (?:project |engineering )?teams?\b/i.test(value) && /\bDenmark\b.*\bIndia\b|\bIndia\b.*\bPoland\b|\bDK\b.*\bIN\b/i.test(value)) return true
  return false
}

function applyRequirementRewrite(text='',req){
  let out=String(text)

  if(req.id==='end_to_end'){
    if(/delivery lifecycle/i.test(out)&&!/end[- ]to[- ]end/i.test(out)) out=out.replace(/delivery lifecycle/i,'end-to-end delivery lifecycle')
    else if(/full lifecycle/i.test(out)&&!/end[- ]to[- ]end/i.test(out)) out=out.replace(/full lifecycle/i,'end-to-end lifecycle')
  }

  if(req.id==='distributed' && supportsDistributedRewrite(out)){
    if(/international (project |engineering )?teams/i.test(out)&&!/distributed/i.test(out)) out=out.replace(/international (project |engineering )?teams/i,match=>`distributed ${match}`)
  }

  if(req.id==='release'){
    if(/release readiness for go-live/i.test(out)) out=out.replace(/release readiness for go-live/i,'release and go-live readiness')
    else if(/release readiness/i.test(out)&&/go-live|RFS|production/i.test(out)&&!/release and go-live readiness/i.test(out)) out=out.replace(/release readiness/i,'release and go-live readiness')
  }

  if(req.id==='risk_dependency'){
    if(/risk,? dependenc(?:y|ies)/i.test(out)) out=out.replace(/risk,? dependenc(?:y|ies)/i,'risk and dependency management')
    else if(/delivery risks? and dependenc(?:y|ies)/i.test(out)) out=out.replace(/delivery risks? and dependenc(?:y|ies)/i,'delivery risk and dependency management')
  }

  if(req.id==='integration'){
    if(/\b(managed|owned|resolved|handled|coordinated)\b/i.test(out)&&/integration/i.test(out)&&/dependenc/i.test(out)&&!/integration dependency management/i.test(out)){
      out=out.replace(/integration[^,.;]*dependenc(?:y|ies)/i,'integration dependency management')
    }
  }

  if(req.id==='governance'){
    if(/\b(programme|program)\b/i.test(out)&&/delivery governance/i.test(out)&&!/programme delivery governance/i.test(out)) out=out.replace(/delivery governance/i,'programme delivery governance')
    else if(/\b(programme|program)\b/i.test(out)&&/backlog governance/i.test(out)&&!/programme-level backlog governance/i.test(out)) out=out.replace(/backlog governance/i,'programme-level backlog governance')
  }

  if(req.id==='regulatory'){
    if(/regulatory/i.test(out)&&/delivery|reporting|compliance/i.test(out)&&!/regulated\s*\/\s*regulatory/i.test(out)) out=out.replace(/regulatory/i,'regulated / regulatory')
  }

  if(req.id==='agile'){
    if(/Agile\/Hybrid execution/i.test(out)) out=out.replace(/Agile\/Hybrid execution/i,'Agile/Hybrid delivery execution')
  }

  return out
}
function matchedTerms(text,terms){
  const lower=String(text).toLowerCase()
  return terms.filter(term=>lower.includes(term.toLowerCase()))
}

export function buildReviewChanges(facts,item){
  const terms=deriveReviewTerms(item)
  const requirements=extractJobRequirements(item)
  const supportedRequirements=requirements.filter(req=>requirementSupported(req,facts))

  return topEvidence(facts,item).map((fact,index)=>{
    const original=cleanSource(fact.text)
    let updated=conservativeRewrite(original)
    const aligned=matchedTerms(original,terms)
    const applied=[]

    for(const req of supportedRequirements){
      if(!matchesAny(original,req.evidence)) continue
      const next=applyRequirementRewrite(updated,req)
      if(next!==updated){
        updated=next
        applied.push(req.label)
      }
    }

    updated=updated.replace(/\s+,/g,',').replace(/\s+/g,' ').trim()
    if(updated&&!/[.!?]$/.test(updated)) updated+='.'

    const originalSentence=`${original}${/[.!?]$/.test(original)?'':'.'}`
    const changed=updated!==originalSentence
    let why='Keeps verified experience intact while making the wording cleaner for this role.'
    if(applied.length) why=`Aligns wording with this job description’s emphasis on ${applied.slice(0,3).join(', ')} while keeping the underlying Master CV evidence unchanged.`
    else if(aligned.length) why=`Keeps the verified experience intact and brings ${aligned.slice(0,3).join(', ')} wording into clearer focus for this role.`
    if(!changed) why=aligned.length?`Already strongly aligned with this role through ${aligned.slice(0,3).join(', ')}; no factual expansion is needed.`:'Already clear and evidence-based; no factual expansion is needed.'
    return {id:fact.id,original,updated,why,terms:aligned,requirements:applied,changed,rank:index}
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
