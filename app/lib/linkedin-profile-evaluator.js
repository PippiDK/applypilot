import {classifyProfileRoleFamily,profileRoleFamiliesCompatible} from './profile-role-family.js'
import {classifyDeliveryDomain} from './profile-delivery-domain.js'
import {semanticProfileExclusion} from './profile-semantic-exclusions.js'

const WINDOWS=new Set([1,3,7,14])
const GENERIC_ROLE_WORDS=new Set(['senior','sr','junior','jr','principal','global','regional','international','experienced','manager','lead','specialist','consultant','coordinator'])
const EXECUTIVE_TITLE=/\b(head of|director|vice president|vp|chief)\b/
const TECHNOLOGY_DIRECTION=/\b(it|information technology|technology|technical|digital|software|systems?|platform|cloud|data|cyber|integration|teknisk|digitalisering|systemer|platforme|integrationer)\b/
const TECHNOLOGY_TITLE=/\b(it|information technology|technology|technical|digital|software|platform|cloud|data|integration|ai|artificial intelligence|cyber|scada|ot|teknisk|digitalisering|systemer|platforme|integrationer)\b/
const TECHNOLOGY_EVIDENCE=[
  /\b(information technology|enterprise it|corporate it|group it|it projects?|it systems?|it platform|technology delivery|technology transformation|technology projects?|digital delivery|digital transformation|digital projects?|it projekt(?:er)?|it leverance(?:r)?|it system(?:er)?|it platform(?:e)?|digitalisering|digitaliseringsprojekt(?:er)?|digitale løsninger|digitale projekt(?:er)?)\b/,
  /\b(software|applications?|api|apis|saas|digital product|enterprise applications?)\b/,
  /\b(platform|enterprise systems?|business systems?|information systems?|it system(?:er)?|it platform(?:e)?|digitale system(?:er)?)\b/,
  /\b(integration|integrations|middleware|interfaces?|integrationer)\b/,
  /\b(cloud|azure|aws|gcp|data platform|data foundation|data warehouse|analytics|business intelligence|databricks|snowflake|artificial intelligence|ai)\b/,
  /\b(cyber|cybersecurity|scada|ot security|operational technology)\b/,
]

const clean=value=>String(value??'').toLowerCase().replace(/[–—_/&]+/g,' ').replace(/[^a-z0-9æøå+.# -]/g,' ').replace(/\s+/g,' ').trim()
const round1=value=>Math.round(value*10)/10

function normalizeRoleLanguage(value=''){
  return clean(value).replace(/-/g,' ')
    .replace(/\bprojektledere?\b/g,'project manager')
    .replace(/\bprojektledelse\b/g,'project management')
    .replace(/\bprojekter\b/g,'project')
    .replace(/\bprogramledere?\b/g,'program manager')
    .replace(/\bprogramledelse\b/g,'program management')
    .replace(/\btekniske?\b/g,'technical')
    .replace(/\bleverancer?\b/g,'delivery')
    .replace(/\bsystemer\b/g,'systems')
    .replace(/\bplatforme\b/g,'platform')
    .replace(/\bintegrationer\b/g,'integration')
    .replace(/\bdigitaliseringsprojekter\b/g,'digital project')
    .replace(/\bdigitalisering\b/g,'digital')
    .replace(/\bdigitale\b/g,'digital')
}

function canonicalRoleTokens(value=''){
  const normalized=normalizeRoleLanguage(value)
    .replace(/\bprogramme\b/g,'program')
    .replace(/\bquality assurance\b/g,'qa')
  const raw=normalized.split(' ').filter(Boolean)
  const tokens=[]
  const hasSoftware=raw.includes('software')
  const hasQuality=raw.includes('qa')||raw.includes('test')||raw.includes('testing')||raw.includes('quality')
  for(const token of raw){
    if(hasSoftware&&(token==='developer'||token==='engineer'||token==='engineering'||token==='programmer')){
      tokens.push('software-builder')
      continue
    }
    if(hasQuality&&(token==='qa'||token==='test'||token==='testing'||token==='quality')){
      tokens.push('quality-test')
      continue
    }
    tokens.push(token)
  }
  return [...new Set(tokens)]
}

function tokenWeight(token){return GENERIC_ROLE_WORDS.has(token)?.35:1}

function roleSimilarity(directionRole,title){
  const direction=canonicalRoleTokens(directionRole)
  const candidate=canonicalRoleTokens(title)
  if(!direction.length||!candidate.length) return {score:0,substantiveCommon:0}
  const candidateSet=new Set(candidate)
  const common=direction.filter(token=>candidateSet.has(token))
  const substantiveCommon=common.filter(token=>!GENERIC_ROLE_WORDS.has(token)).length
  const commonWeight=common.reduce((sum,token)=>sum+tokenWeight(token),0)
  const directionWeight=direction.reduce((sum,token)=>sum+tokenWeight(token),0)
  const candidateWeight=candidate.reduce((sum,token)=>sum+tokenWeight(token),0)
  const denominator=Math.min(directionWeight,candidateWeight)
  return {score:denominator?Math.min(1,commonWeight/denominator):0,substantiveCommon}
}

function jdSupport(directionRole,job){
  const direction=canonicalRoleTokens(directionRole).filter(token=>!GENERIC_ROLE_WORDS.has(token))
  if(!direction.length) return 0
  const textTokens=new Set(canonicalRoleTokens(`${job.title} ${job.description}`))
  return direction.filter(token=>textTokens.has(token)).length/direction.length
}

function strongRoleFamily(value=''){
  const normalized=normalizeRoleLanguage(value).replace(/\bprogramme\b/g,'program')
  if(/\b(product manager|product owner|product lead|product director)\b/.test(normalized)) return 'product'
  if(/\b(software developer|software engineer|software engineering|developer|programmer)\b/.test(normalized)) return 'software-builder'
  if(/\b(qa manager|qa lead|test manager|test lead|quality assurance|software tester|testing manager)\b/.test(normalized)) return 'quality-test'
  if(/\b(project|program|delivery)\b/.test(normalized)) return 'delivery-management'
  return ''
}

function technologyEvidence(job){
  const normalized=normalizeRoleLanguage(`${job.title} ${job.description}`)
  return TECHNOLOGY_EVIDENCE.filter(pattern=>pattern.test(normalized)).length
}

function confirmsDirection(directionRole,job){
  const direction=clean(directionRole)
  const title=clean(job.title)
  if(EXECUTIVE_TITLE.test(title)&&!EXECUTIVE_TITLE.test(direction)) return false
  const directionFamily=strongRoleFamily(direction)
  const titleFamily=strongRoleFamily(title)
  if(directionFamily&&titleFamily&&directionFamily!==titleFamily) return false
  if(TECHNOLOGY_DIRECTION.test(direction)){
    const evidence=technologyEvidence(job)
    const titleConfirmsTechnology=TECHNOLOGY_TITLE.test(title)
    if(evidence<2&&!(titleConfirmsTechnology&&evidence>=1)) return false
  }
  return true
}

function familyCompatibleDirections(foundBy=[],jobFamily=''){
  return (Array.isArray(foundBy)?foundBy:[]).filter(direction=>{
    const directionFamily=classifyProfileRoleFamily({title:direction?.role}).family
    return profileRoleFamiliesCompatible(jobFamily,directionFamily)
  })
}

function profileEvaluation(job,foundBy=[]){
  let best=null
  for(const direction of Array.isArray(foundBy)?foundBy:[]){
    const similarity=roleSimilarity(direction?.role,job.title)
    const support=jdSupport(direction?.role,job)
    const relevant=confirmsDirection(direction?.role,job) && similarity.substantiveCommon>0 && (similarity.score>=0.45||support>=0.65)
    if(!relevant) continue
    const tier=direction?.tier==='primary'?'primary':'adjacent'
    const base=tier==='primary'?6.5:5.9
    const score=Math.min(9.6,round1(base+similarity.score*2.2+support*.9))
    const candidate={direction,tier,similarity:similarity.score,support,score}
    if(!best||candidate.score>best.score) best=candidate
  }
  if(!best) return {pass:false,reason:'Vacancy does not confirm an approved Search Profile role direction',evaluation:null}
  const verdict=best.score>=9?'Strong profile match':best.score>=7.5?'Profile match':'Possible profile match'
  const action=best.score>=7.5?'Consider':'Hold'
  return {
    pass:true,
    reason:null,
    evaluation:{
      score:best.score,
      verdict,
      action,
      match:[`${best.tier==='primary'?'Primary':'Adjacent'} role direction: ${best.direction.role}`],
      gaps:[],
      hardExclusion:false,
      breakdown:{roleDirection:best.direction.role,tier:best.tier,titleAlignment:Math.round(best.similarity*100),jdSupport:Math.round(best.support*100)},
    },
  }
}

function phraseMatch(text,value){
  const haystack=clean(text)
  const needle=clean(value)
  return Boolean(needle&&haystack.includes(needle))
}

function requiredLanguage(description,value){
  const language=clean(value)
  if(!language) return false
  const sentences=String(description??'').split(/(?<=[.!?;])\s+|\n+/)
  return sentences.some(sentence=>{
    const normalized=clean(sentence)
    if(!normalized.includes(language)) return false
    if(/\b(preferred|advantage|nice to have|optional|beneficial|plus|desirable|not required|not mandatory)\b/.test(normalized)) return false
    return /\b(required|mandatory|must|fluent|fluency|proficient|proficiency|professional|native|kræves|påkrævet|flydende)\b/.test(normalized)
  })
}

function deterministicExclusion(job,rules=[]){
  for(const rule of Array.isArray(rules)?rules:[]){
    if(rule?.evaluation!=='deterministic') continue
    const operator=String(rule?.operator??'')
    if(!['exclude','exclude_if_required','avoid'].includes(operator)) continue
    const category=String(rule?.category??'')
    const value=String(rule?.value??'').trim()
    if(!value) continue
    let matched=false
    if(category==='company') matched=phraseMatch(job.company,value)
    else if(category==='role') matched=phraseMatch(job.title,value)
    else if(category==='domain') matched=phraseMatch(`${job.title} ${job.description}`,value)
    else if(category==='employment_type') matched=phraseMatch(job.employmentType,value)
    else if(category==='work_model') matched=phraseMatch(job.remoteType,value)
    else if(category==='location') matched=phraseMatch(job.location,value)
    else if(category==='language_requirement'&&operator==='exclude_if_required') matched=requiredLanguage(job.description,value)
    if(matched) return `Search Profile exclusion: ${rule.originalText||`${category} ${operator} ${value}`}`
  }
  return null
}

function domainRejectReason(classification={}){
  if(classification.domain==='NON_TARGET_PHYSICAL') return 'Delivery domain is physical construction / civil infrastructure rather than target technology delivery'
  if(classification.domain==='NON_TARGET_FUNCTIONAL') return 'Delivery domain is function-specific rather than target technology delivery'
  if(classification.domain==='EXCLUDED_SPECIALISM'){
    if(classification.evidence?.includes('erp')) return 'ERP specialist role is outside the target delivery domain'
    if(classification.evidence?.includes('r&d')) return 'R&D specialist role is outside the target delivery domain'
    return 'Specialist domain is outside the target technology delivery scope'
  }
  return 'Delivery domain is outside the target technology delivery scope'
}

function withinFreshness(publishedAt,days,now){
  if(!publishedAt) return false
  const published=new Date(publishedAt)
  if(!Number.isFinite(published.getTime())) return false
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  const posted=Date.UTC(published.getUTCFullYear(),published.getUTCMonth(),published.getUTCDate())
  const ageDays=Math.floor((today-posted)/86400000)
  return ageDays>=0&&ageDays<=days
}

export function evaluateProfileJob({candidate={},job,freshnessDays=7,exclusionRules=[],now=new Date()}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  if(!job) return {keep:false,evaluated:false,stage:'FULL_JD_UNVERIFIED',decision:'REJECT',reason:'Full Job Description could not be verified',score:null,evaluation:null}
  if(job.vacancyStatus==='CLOSED') return {keep:false,evaluated:false,stage:'VACANCY_CLOSED',decision:'REJECT',reason:'Vacancy is closed or its explicit deadline has passed',score:null,evaluation:null}
  if(!withinFreshness(job.publishedAt,days,now)) return {keep:false,evaluated:false,stage:'FRESHNESS_REJECT',decision:'REJECT',reason:`Vacancy is outside the selected ${days}-day window`,score:null,evaluation:null}
  const exclusion=deterministicExclusion(job,exclusionRules)
  if(exclusion) return {keep:false,evaluated:false,stage:'PROFILE_EXCLUSION_REJECT',decision:'REJECT',reason:exclusion,score:null,evaluation:null}

  const domainClassification=classifyDeliveryDomain(job)
  const semanticExclusion=semanticProfileExclusion(job,exclusionRules,domainClassification)
  if(semanticExclusion) return {keep:false,evaluated:false,stage:'PROFILE_EXCLUSION_REJECT',decision:'REJECT',reason:semanticExclusion,score:null,evaluation:null}

  const roleFamily=classifyProfileRoleFamily(job)
  const compatibleDirections=familyCompatibleDirections(candidate.foundBy,roleFamily.family)
  if(!compatibleDirections.length){
    return {keep:false,evaluated:true,stage:'PROFILE_ROLE_FAMILY_REJECT',decision:'REJECT',reason:'Vacancy professional role family does not match an approved Search Profile role direction',score:0,evaluation:null}
  }

  if(['NON_TARGET_PHYSICAL','NON_TARGET_FUNCTIONAL','EXCLUDED_SPECIALISM'].includes(domainClassification.domain)){
    return {keep:false,evaluated:true,stage:'PROFILE_DOMAIN_REJECT',decision:'REJECT',reason:domainRejectReason(domainClassification),score:0,evaluation:null}
  }

  if(domainClassification.domain==='AMBIGUOUS'){
    return {keep:false,evaluated:true,stage:'PROFILE_DOMAIN_AMBIGUOUS',decision:'HOLD',reason:'Delivery domain is not sufficiently confirmed from the Full JD',score:null,evaluation:null}
  }

  const result=profileEvaluation(job,compatibleDirections)
  if(!result.pass) return {keep:false,evaluated:true,stage:'PROFILE_ROLE_REJECT',decision:'REJECT',reason:result.reason,score:0,evaluation:null}
  const evaluation=result.evaluation
  return {keep:true,evaluated:true,stage:'KEPT',decision:'KEEP',reason:`Matched ${evaluation.breakdown.tier} Search Profile direction: ${evaluation.breakdown.roleDirection}`,score:Math.round(evaluation.score*10),evaluation}
}
