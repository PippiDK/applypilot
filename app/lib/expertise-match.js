import {EXPERTISE_CATEGORIES,EXPERTISE_IMPORTANCE} from './expertise-requirements.js'
import {detectCvStructure} from './cv-sections.js'

const IMPORTANCE_WEIGHT={critical:3,core:2,supporting:1}
const STATUS_CREDIT={MATCHED:1,PARTIAL:.5,NOT_EVIDENCED:0}
const STATUS_GAP_ORDER={NOT_EVIDENCED:0,PARTIAL:1,MATCHED:2}

function normalize(value=''){
  return String(value??'')
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g,'')
    .replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-')
    .toLowerCase()
    .replace(/[^a-z0-9æøå+/#&. -]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function escapeRx(value=''){ return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') }

function termPattern(term=''){
  const token=normalize(term)
  if(!token) return null
  return new RegExp(`(?<![a-z0-9æøå])${escapeRx(token).replace(/\\ /g,'\\s+')}(?![a-z0-9æøå])`,'i')
}

function termPresent(text,term){
  const rx=termPattern(term)
  return Boolean(rx&&rx.test(normalize(text)))
}

function firstPresentTerm(text,terms=[]){ return (terms||[]).find(term=>termPresent(text,term))||'' }

function sentences(value=''){
  return String(value??'').split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).filter(Boolean)
}

function yearsInSentence(sentence=''){
  const text=normalize(sentence)
  const values=[]
  for(const match of text.matchAll(/\b(?:more than\s+|over\s+)?(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/g)) values.push(Number(match[1]))
  const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10}
  for(const [word,value] of Object.entries(words)) if(new RegExp(`\\b(?:more than\\s+|over\\s+)?${word}\\s*\\+?\\s*(?:years?|yrs?)\\b`,'i').test(text)) values.push(value)
  return values.filter(Number.isFinite)
}

function durationEvidence(cvText,terms,minimumYears){
  if(!minimumYears) return true
  for(const sentence of sentences(cvText)){
    if(!(terms||[]).some(term=>termPresent(sentence,term))) continue
    if(yearsInSentence(sentence).some(years=>years>=minimumYears)) return true
  }
  try{
    const structure=detectCvStructure(cvText)
    const currentYear=new Date().getUTCFullYear()
    for(const role of structure.employmentSections||[]){
      if(!(terms||[]).some(term=>termPresent(role.sectionText,term))) continue
      const endYear=role.openEnded?currentYear:Number(role.endYear)
      const startYear=Number(role.startYear)
      if(Number.isFinite(startYear)&&Number.isFinite(endYear)&&Math.max(0,endYear-startYear)>=minimumYears) return true
    }
  }catch{}
  return false
}

function evidenceExcerpt(cvText,term=''){
  if(!term) return ''
  const original=String(cvText??'')
  const token=normalize(term)
  const normalized=normalize(original)
  const index=normalized.indexOf(token)
  if(index<0) return ''
  const start=Math.max(0,index-90),end=Math.min(original.length,index+token.length+150)
  return original.slice(start,end).replace(/\s+/g,' ').trim()
}

function matchEvidenceGroup(group,cvText=''){
  const directTerm=firstPresentTerm(cvText,group?.directEvidenceTerms||[])
  if(directTerm) return {status:'MATCHED',evidenceTerm:directTerm,evidenceExcerpt:evidenceExcerpt(cvText,directTerm)}
  const transferableTerm=firstPresentTerm(cvText,group?.transferableEvidenceTerms||[])
  if(transferableTerm) return {status:'PARTIAL',evidenceTerm:transferableTerm,evidenceExcerpt:evidenceExcerpt(cvText,transferableTerm)}
  return {status:'NOT_EVIDENCED',evidenceTerm:'',evidenceExcerpt:''}
}

export function matchRequirementEvidence(requirement,cvText=''){
  const groups=Array.isArray(requirement?.evidenceGroups)?requirement.evidenceGroups.filter(Boolean):[]
  const rule=requirement?.evidenceRule
  if(groups.length&&['any_group','all_groups'].includes(rule)){
    const groupResults=groups.map(group=>({...matchEvidenceGroup(group,cvText),label:String(group?.label||'').trim()}))
    const directGroups=groupResults.filter(x=>x.status==='MATCHED')
    const partialGroups=groupResults.filter(x=>x.status==='PARTIAL')
    const firstEvidence=directGroups[0]||partialGroups[0]||{evidenceTerm:'',evidenceExcerpt:''}

    if(rule==='any_group'){
      if(directGroups.length){
        const directTerms=groups.flatMap(group=>group.directEvidenceTerms||[])
        if(Number(requirement?.minimumYears||0)>0&&!durationEvidence(cvText,directTerms,Number(requirement.minimumYears))){
          return {status:'PARTIAL',evidenceTerm:firstEvidence.evidenceTerm,evidenceExcerpt:firstEvidence.evidenceExcerpt,reason:'Required duration is not evidenced for the same capability in Source CV',groupResults}
        }
        return {status:'MATCHED',evidenceTerm:firstEvidence.evidenceTerm,evidenceExcerpt:firstEvidence.evidenceExcerpt,reason:'At least one acceptable capability alternative is directly evidenced in Source CV',groupResults}
      }
      if(partialGroups.length) return {status:'PARTIAL',evidenceTerm:firstEvidence.evidenceTerm,evidenceExcerpt:firstEvidence.evidenceExcerpt,reason:'An acceptable capability alternative is only partially evidenced in Source CV',groupResults}
      return {status:'NOT_EVIDENCED',evidenceTerm:'',evidenceExcerpt:'',reason:'No acceptable capability alternative is evidenced in Source CV',groupResults}
    }

    if(directGroups.length===groups.length){
      const directTerms=groups.flatMap(group=>group.directEvidenceTerms||[])
      if(Number(requirement?.minimumYears||0)>0&&!durationEvidence(cvText,directTerms,Number(requirement.minimumYears))){
        return {status:'PARTIAL',evidenceTerm:firstEvidence.evidenceTerm,evidenceExcerpt:firstEvidence.evidenceExcerpt,reason:'Required duration is not evidenced for the same capability in Source CV',groupResults}
      }
      return {status:'MATCHED',evidenceTerm:firstEvidence.evidenceTerm,evidenceExcerpt:firstEvidence.evidenceExcerpt,reason:'All required capability groups are directly evidenced in Source CV',groupResults}
    }
    if(directGroups.length||partialGroups.length) return {status:'PARTIAL',evidenceTerm:firstEvidence.evidenceTerm,evidenceExcerpt:firstEvidence.evidenceExcerpt,reason:'Some required capability groups are evidenced in Source CV',groupResults}
    return {status:'NOT_EVIDENCED',evidenceTerm:'',evidenceExcerpt:'',reason:'Required capability groups are not evidenced in Source CV',groupResults}
  }

  const directTerm=firstPresentTerm(cvText,requirement?.directEvidenceTerms||[])
  const transferableTerm=firstPresentTerm(cvText,requirement?.transferableEvidenceTerms||[])
  if(directTerm){
    if(Number(requirement?.minimumYears||0)>0 && !durationEvidence(cvText,requirement.directEvidenceTerms,Number(requirement.minimumYears))){
      return {status:'PARTIAL',evidenceTerm:directTerm,evidenceExcerpt:evidenceExcerpt(cvText,directTerm),reason:'Required duration is not evidenced for the same capability in Source CV'}
    }
    return {status:'MATCHED',evidenceTerm:directTerm,evidenceExcerpt:evidenceExcerpt(cvText,directTerm),reason:'Direct capability evidence found in Source CV'}
  }
  if(transferableTerm) return {status:'PARTIAL',evidenceTerm:transferableTerm,evidenceExcerpt:evidenceExcerpt(cvText,transferableTerm),reason:'Transferable evidence found in Source CV'}
  return {status:'NOT_EVIDENCED',evidenceTerm:'',evidenceExcerpt:'',reason:'Not evidenced in Source CV'}
}

function scoreFor(items=[]){
  const possible=items.reduce((sum,item)=>sum+(IMPORTANCE_WEIGHT[item.importance]||0),0)
  if(!possible) return null
  const earned=items.reduce((sum,item)=>sum+(IMPORTANCE_WEIGHT[item.importance]||0)*(STATUS_CREDIT[item.status]??0),0)
  return Math.round(earned/possible*100)
}

function importanceRank(value){ return EXPERTISE_IMPORTANCE.indexOf(value) }

export function evaluateExpertise(requirements=[],cvText=''){
  const sourceCv=String(cvText??'').trim()
  if(sourceCv.length<40) throw new Error('Source CV text is required for Expertise Match.')
  if(!Array.isArray(requirements)||!requirements.length) throw new Error('Structured JD requirements are required for Expertise Match.')

  const evaluated=requirements.map(requirement=>({...requirement,...matchRequirementEvidence(requirement,sourceCv)}))
  const breakdown={}
  for(const category of EXPERTISE_CATEGORIES){
    const items=evaluated.filter(item=>item.category===category)
    breakdown[category]={
      score:scoreFor(items),
      matched:items.filter(x=>x.status==='MATCHED').length,
      partial:items.filter(x=>x.status==='PARTIAL').length,
      notEvidenced:items.filter(x=>x.status==='NOT_EVIDENCED').length,
      total:items.length
    }
  }

  const expertiseMatch=scoreFor(evaluated)??0
  const matched=[...evaluated].filter(x=>x.status==='MATCHED').sort((a,b)=>importanceRank(a.importance)-importanceRank(b.importance))
  const gaps=[...evaluated].filter(x=>x.status!=='MATCHED').sort((a,b)=>importanceRank(a.importance)-importanceRank(b.importance)||STATUS_GAP_ORDER[a.status]-STATUS_GAP_ORDER[b.status])

  const whyYouFit=matched.slice(0,5).map(item=>item.capability)
  const expertiseGaps=gaps.slice(0,5).map(item=>item.status==='PARTIAL'
    ? `${item.capability} — partially evidenced in Source CV`
    : `${item.capability} — not evidenced in Source CV`)

  return {expertiseMatch,whyYouFit,expertiseGaps,breakdown,requirements:evaluated}
}
