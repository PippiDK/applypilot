const WINDOWS=new Set([1,3,7,14])

const clean=value=>String(value??'').toLowerCase().replace(/[–—_/&]+/g,' ').replace(/[^a-z0-9æøå+.# -]/g,' ').replace(/\s+/g,' ').trim()

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

function withinFreshness(publishedAt,days,now){
  if(!publishedAt) return false
  const published=new Date(publishedAt)
  if(!Number.isFinite(published.getTime())) return false
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  const posted=Date.UTC(published.getUTCFullYear(),published.getUTCMonth(),published.getUTCDate())
  const ageDays=Math.floor((today-posted)/86400000)
  return ageDays>=0&&ageDays<=days
}

export function evaluateProfilePrecheck({job,freshnessDays=7,exclusionRules=[],now=new Date()}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  if(!job) return {pass:false,evaluated:false,stage:'FULL_JD_UNVERIFIED',decision:'UNVERIFIED',reason:'Full Job Description could not be verified'}
  if(job.vacancyStatus==='CLOSED') return {pass:false,evaluated:false,stage:'VACANCY_CLOSED',decision:'REJECT',reason:'Vacancy is closed or its explicit deadline has passed'}
  if(!withinFreshness(job.publishedAt,days,now)) return {pass:false,evaluated:false,stage:'FRESHNESS_REJECT',decision:'REJECT',reason:`Vacancy is outside the selected ${days}-day window`}
  const exclusion=deterministicExclusion(job,exclusionRules)
  if(exclusion) return {pass:false,evaluated:false,stage:'PROFILE_EXCLUSION_REJECT',decision:'REJECT',reason:exclusion}
  return {pass:true,evaluated:true,stage:'READY_FOR_SEMANTIC_EVALUATION',decision:'PENDING',reason:null}
}

export function semanticInputForCandidate({candidate={},job={}}={}){
  return {
    jobId:String(candidate?.jobId??''),
    title:String(job?.title??''),
    description:String(job?.description??''),
    directions:(Array.isArray(candidate?.foundBy)?candidate.foundBy:[]).map(direction=>({
      key:String(direction?.key||direction?.role||'').trim(),
      role:String(direction?.role||'').trim(),
      tier:direction?.tier==='primary'?'primary':'adjacent'
    })).filter(direction=>direction.key&&direction.role)
  }
}

export function applySemanticProfileMatch({candidate={},job={},semantic={}}={}){
  if(!semantic?.compatible){
    return {keep:false,evaluated:true,stage:'PROFILE_ROLE_REJECT',decision:'REJECT',reason:String(semantic?.reason||'Vacancy work does not match an approved Search Profile direction'),score:Number.isFinite(semantic?.score)?semantic.score:0,evaluation:null}
  }

  const directions=Array.isArray(candidate?.foundBy)?candidate.foundBy:[]
  const direction=directions.find(item=>String(item?.key||item?.role||'').trim()===String(semantic?.directionKey||''))
  if(!direction) throw new Error('Validated semantic direction is missing from candidate provenance.')

  const semanticScore=Math.max(0,Math.min(100,Math.round(Number(semantic.score)||0)))
  const tier=direction?.tier==='primary'?'primary':'adjacent'
  const rankingScore=Math.min(100,semanticScore+(tier==='primary'?6:0))
  const score=Math.round(rankingScore)/10
  const verdict=rankingScore>=90?'Strong profile match':rankingScore>=75?'Profile match':'Possible profile match'
  const action=rankingScore>=75?'Consider':'Hold'

  const evaluation={
    score,
    verdict,
    action,
    match:[`${tier==='primary'?'Primary':'Adjacent'} role direction: ${direction.role}`],
    gaps:[],
    hardExclusion:false,
    breakdown:{
      roleDirection:direction.role,
      tier,
      semanticCompatibility:semanticScore
    }
  }
  return {keep:true,evaluated:true,stage:'KEPT',decision:'KEEP',reason:String(semantic.reason),score:rankingScore,evaluation}
}
