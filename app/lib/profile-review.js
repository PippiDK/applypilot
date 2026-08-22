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
    jd:[/programme governance/i,/program governance/i,/delivery governance/i,/structured governance/i,/\bgovernance\b/i,/PMO/i],
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

function buildLegacyBulletChanges(facts,item){
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

const SUMMARY_PHRASES={
  end_to_end:'end-to-end delivery',
  distributed:'distributed international teams',
  release:'release and go-live readiness',
  risk_dependency:'risk and dependency management',
  integration:'systems integration',
  governance:'delivery governance',
  regulatory:'regulatory and compliance delivery',
  agile:'Agile/Hybrid delivery'
}

const SUMMARY_HEADING=/^(professional\s+summary|summary|professional\s+profile|profile|career\s+summary|executive\s+summary)$/i
const SUMMARY_STOP_HEADING=/^(professional\s+experience|work\s+experience|experience|employment|career\s+history|skills|core\s+competenc(?:e|es|ies)|key\s+skills|technical\s+skills|education|certifications?|courses?)$/i

export function extractSummaryFromText(text=''){
  const raw=String(text).replace(/\r/g,'\n')
  const lines=raw.split('\n').map(line=>line.trim()).filter(Boolean)
  const headingIndex=lines.findIndex(line=>SUMMARY_HEADING.test(line))
  if(headingIndex>=0){
    const stopIndex=lines.findIndex((line,index)=>index>headingIndex&&SUMMARY_STOP_HEADING.test(line))
    if(stopIndex<0) return ''
    const summary=cleanSource(lines.slice(headingIndex+1,stopIndex).join(' '))
    return summary.length>=40?summary:''
  }

  const stopIndex=lines.findIndex(line=>SUMMARY_STOP_HEADING.test(line))
  const headerArea=lines.slice(0,stopIndex>=0?stopIndex:Math.min(lines.length,10))
  const candidates=headerArea.filter((line,index)=>index>=1&&line.length>=55&&!/@|https?:\/\/|linkedin|\+?\d[\d ()-]{6,}/i.test(line))
  return cleanSource(candidates.join(' '))
}

function extractMasterSummary(cvData={}){
  const explicit=cleanSource(cvData?.summary||'')
  if(explicit) return explicit
  return extractSummaryFromText(cvData?.preview||'')
}

function splitSummarySentences(summary=''){
  const value=cleanSource(summary)
  if(!value) return []
  const sentences=value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]
  return sentences.map(sentence=>sentence.trim()).filter(Boolean)
}

function wordCount(text=''){
  const value=cleanSource(text)
  return value?value.split(/\s+/).length:0
}

function sentenceRequirementIds(sentence,item){
  return extractJobRequirements(item)
    .filter(req=>matchesAny(sentence,req.evidence))
    .map(req=>req.id)
}

function sentenceTermMatches(sentence,item){
  return matchedTerms(sentence,deriveReviewTerms(item))
}

function isProfessionalIdentity(sentence=''){
  return /\b(senior|lead|manager|consultant|director|head)\b/i.test(sentence)
    && /\b(project|delivery|program|programme|technology|technical|IT)\b/i.test(sentence)
}

function identitySentenceIndex(sentences=[]){
  const withYears=sentences.findIndex(sentence=>isProfessionalIdentity(sentence)&&/\b\d+\+?\s*years?\b/i.test(sentence))
  if(withYears>=0) return withYears
  const role=sentences.findIndex(sentence=>isProfessionalIdentity(sentence))
  return role>=0?role:0
}

function isConcreteProof(sentence=''){
  return /^\s*(most recently|previously)\b/i.test(sentence)
    || /\bNGSP\b/i.test(sentence)
    || /\b\d+\+?\s*(?:specialists?|people|countries)\b/i.test(sentence)
}


function summaryCandidate(sentence,index,item){
  const requirements=sentenceRequirementIds(sentence,item)
  const terms=sentenceTermMatches(sentence,item)
  let score=requirements.length*5+terms.length*2
  if(isConcreteProof(sentence)) score+=4
  if(/^\s*(skilled|strong|experienced)\b/i.test(sentence)&&score>0) score+=2
  if(/^\s*responsible for\b/i.test(sentence)) score-=1
  if(/^\s*(known for|comfortable)\b/i.test(sentence)&&requirements.length===0) score-=2
  return {sentence,index,requirements,terms,score,words:wordCount(sentence),proof:isConcreteProof(sentence)}
}

function combinations(values,minSize,maxSize){
  const result=[]
  function walk(start,picked){
    if(picked.length>=minSize) result.push([...picked])
    if(picked.length===maxSize) return
    for(let i=start;i<values.length;i++){
      picked.push(values[i])
      walk(i+1,picked)
      picked.pop()
    }
  }
  walk(0,[])
  return result
}

function comboScore(identity,candidates){
  const requirements=new Set()
  const terms=new Set()
  let base=0
  let duplicateRequirementHits=0
  let proofCount=0
  for(const candidate of candidates){
    base+=candidate.score
    if(candidate.proof) proofCount+=1
    for(const req of candidate.requirements){
      if(requirements.has(req)) duplicateRequirementHits+=1
      requirements.add(req)
    }
    for(const term of candidate.terms) terms.add(term)
  }
  const words=wordCount(identity)+candidates.reduce((total,candidate)=>total+candidate.words,0)
  const lengthBonus=words>=90?24-Math.abs(105-words)*0.35:-(90-words)*0.45
  const extraSentencePenalty=Math.max(0,candidates.length-3)*8
  return base+requirements.size*8+terms.size*2+Math.min(proofCount,1)*4-duplicateRequirementHits*2+lengthBonus-extraSentencePenalty
}

function selectTailoredSummarySentences(sentences,item){
  if(!sentences.length) return []
  const identityIndex=identitySentenceIndex(sentences)
  const identity=sentences[identityIndex]
  const candidates=sentences
    .map((sentence,index)=>summaryCandidate(sentence,index,item))
    .filter(candidate=>candidate.index!==identityIndex&&candidate.score>0)

  if(!candidates.length) return [identity]

  const requiresProof=candidates.some(candidate=>candidate.proof)
  const withLengthLimit=combinations(candidates,Math.min(2,candidates.length),Math.min(4,candidates.length))
    .filter(combo=>wordCount(identity)+combo.reduce((total,candidate)=>total+candidate.words,0)<=120)
  const viable=requiresProof?withLengthLimit.filter(combo=>combo.some(candidate=>candidate.proof)):withLengthLimit

  const fallback=combinations(candidates,1,Math.min(4,candidates.length))
    .filter(combo=>wordCount(identity)+combo.reduce((total,candidate)=>total+candidate.words,0)<=120)
  const proofFallback=requiresProof?fallback.filter(combo=>combo.some(candidate=>candidate.proof)):fallback
  const pool=viable.length?viable:proofFallback.length?proofFallback:fallback

  if(!pool.length) return [identity]

  const best=[...pool].sort((a,b)=>comboScore(identity,b)-comboScore(identity,a))[0]
  const ordered=[...best].sort((a,b)=>{
    const aCapability=/^\s*(skilled|strong|experienced)\b/i.test(a.sentence)?1:0
    const bCapability=/^\s*(skilled|strong|experienced)\b/i.test(b.sentence)?1:0
    if(aCapability!==bCapability) return bCapability-aCapability
    if(a.proof!==b.proof) return Number(b.proof)-Number(a.proof)
    return b.score-a.score||a.index-b.index
  })
  return [identity,...ordered.map(candidate=>candidate.sentence)]
}

function naturalList(values=[]){
  if(values.length<=1) return values[0]||''
  if(values.length===2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0,-1).join(', ')}, and ${values.at(-1)}`
}

function buildSummaryReviewChanges(cvData,item){
  const original=extractMasterSummary(cvData)
  const facts=Array.isArray(cvData?.facts)?cvData.facts:[]
  if(!original||!facts.length) return []

  const sentences=splitSummarySentences(original)
  if(!sentences.length) return []

  const selected=selectTailoredSummarySentences(sentences,item)
  const updated=cleanSource(selected.join(' '))
  const normalizedOriginal=cleanSource(original)
  if(!updated||updated===normalizedOriginal) return []

  const selectedText=selected.join(' ')
  const requirementLabels=extractJobRequirements(item)
    .filter(req=>matchesAny(selectedText,req.evidence)&&requirementSupported(req,facts))
    .map(req=>req.label)
    .slice(0,4)

  const why=requirementLabels.length
    ?`Shortens the Summary and foregrounds verified evidence most relevant to this JD: ${naturalList(requirementLabels)}. The tailored text uses only sentences already present in the Master Summary.`
    :'Shortens the Summary by keeping the professional identity first and prioritising existing Master Summary evidence relevant to this role.'

  return [{
    id:'SUMMARY',
    type:'summary',
    original:normalizedOriginal,
    updated,
    why,
    terms:deriveReviewTerms(item),
    requirements:requirementLabels,
    changed:true,
    rank:0
  }]
}

export function buildReviewChanges(cvDataOrFacts,item){
  if(Array.isArray(cvDataOrFacts)) return buildLegacyBulletChanges(cvDataOrFacts,item)
  return buildSummaryReviewChanges(cvDataOrFacts,item)
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
