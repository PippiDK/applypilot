const WINDOWS=new Set([1,3,7,14])
const GENERIC_ROLE_WORDS=new Set(['senior','sr','junior','jr','principal','global','regional','international','experienced','manager','lead','specialist','consultant','coordinator'])

const clean=value=>String(value??'').toLowerCase().replace(/[–—_/&]+/g,' ').replace(/[^a-z0-9æøå+.# -]/g,' ').replace(/\s+/g,' ').trim()
const round1=value=>Math.round(value*10)/10

function canonicalRoleTokens(value=''){
  const text=clean(value)
    .replace(/\bprogramme\b/g,'program')
    .replace(/\bquality assurance\b/g,'qa')
  const raw=text.split(' ').filter(Boolean)
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

function profileEvaluation(job,foundBy=[]){
  let best=null
  for(const direction of Array.isArray(foundBy)?foundBy:[]){
    const similarity=roleSimilarity(direction?.role,job.title)
    const support=jdSupport(direction?.role,job)
    const relevant=similarity.substantiveCommon>0 && (similarity.score>=0.45||support>=0.65)
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
      breakdown:{
        roleDirection:best.direction.role,
        tier:best.tier,
        titleAlignment:Math.round(best.similarity*100),
        jdSupport:Math.round(best.support*100),
      },
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

function denmarkDateKey(value){
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime())) return null
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const part=type=>parts.find(item=>item.type===type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function withinFreshness(publishedAt,days,now){
  if(!publishedAt) return false
  const published=new Date(publishedAt)
  if(!Number.isFinite(published.getTime())) return false
  if(Number(days)===1) return denmarkDateKey(published)===denmarkDateKey(now)
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  const posted=Date.UTC(published.getUTCFullYear(),published.getUTCMonth(),published.getUTCDate())
  const ageDays=Math.floor((today-posted)/86400000)
  return ageDays>=0&&ageDays<=days
}

export function evaluateProfileJob({job={},foundBy=[],exclusionRules=[],freshnessDays=7,now=new Date()}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7

  if(job.vacancyStatus==='CLOSED'){
    return {pass:false,stage:'VACANCY_CLOSED',decision:'REJECT',reason:'Vacancy is closed or its explicit deadline has passed',evaluation:null}
  }
  if(!withinFreshness(job.publishedAt,days,now)){
    return {pass:false,stage:'FRESHNESS_REJECT',decision:'REJECT',reason:`Vacancy is outside the selected ${days}-day window`,evaluation:null}
  }

  const exclusion=deterministicExclusion(job,exclusionRules)
  if(exclusion){
    return {pass:false,stage:'PROFILE_EXCLUSION_REJECT',decision:'REJECT',reason:exclusion,evaluation:null}
  }

  const result=profileEvaluation(job,foundBy)
  if(!result.pass){
    return {pass:false,stage:'PROFILE_ROLE_REJECT',decision:'REJECT',reason:result.reason,evaluation:null}
  }

  const evaluation=result.evaluation
  return {
    pass:true,
    stage:'KEPT',
    decision:'KEEP',
    reason:`Matched ${evaluation.breakdown.tier} Search Profile direction: ${evaluation.breakdown.roleDirection}`,
    evaluation,
  }
}
