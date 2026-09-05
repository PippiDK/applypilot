import {createHash} from 'node:crypto'
import {analyzeExpertiseMatch} from './expertise-service.js'

export const EXPERTISE_MATCH_ENGINE_VERSION='expertise-match-v3'

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const identityText=value=>clean(value).toLowerCase().replace(/\b(a\/s|as)\b/g,'').replace(/[^a-z0-9æøå]+/g,' ').replace(/\s+/g,' ').trim()

function requireSupabase(supabase){
  if(!supabase||typeof supabase.from!=='function') throw new Error('Expertise Match cache requires Supabase')
}

function publishedDay(job={}){
  const raw=job.publishedAt||job.postedDate||job.datePosted
  if(!raw) return ''
  const date=new Date(raw)
  return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):''
}

export function logicalExpertiseJobKey(job={},fallbackKey=''){
  const company=identityText(job.company)
  const title=identityText(job.title)
  const location=identityText(job.location)
  const day=publishedDay(job)
  if(company&&title&&day) return `logical:${company}|${title}|${location}|${day}`

  const fallback=clean(fallbackKey)||clean(job.jobId)||(
    clean(job.source)&&clean(job.sourceJobId)?`${clean(job.source).toLowerCase()}:${clean(job.sourceJobId)}`:''
  )
  if(!fallback) throw new Error('Expertise Match cache requires logical job identity')
  return fallback
}

export function expertiseMatchCacheReference({
  userId,
  logicalJobKey,
  profileFingerprint,
  engineVersion=EXPERTISE_MATCH_ENGINE_VERSION,
}={}){
  const user=clean(userId)
  const job=clean(logicalJobKey)
  const profile=clean(profileFingerprint)
  const engine=clean(engineVersion)
  if(!user||!job||!profile||!engine) throw new Error('Expertise Match cache identity is incomplete')
  const digest=createHash('sha256').update([user,job,profile,engine].join('\n')).digest('hex')
  return `expertise-match:${digest}`
}

export async function getOrCreateExpertiseMatch({
  supabase,
  userId,
  job={},
  logicalJobKey,
  profileFingerprint,
  cvText,
  engineVersion=EXPERTISE_MATCH_ENGINE_VERSION,
  analyze=analyzeExpertiseMatch,
}={}){
  requireSupabase(supabase)
  if(typeof analyze!=='function') throw new Error('Expertise Match analyzer is required')

  const user=clean(userId)
  if(!user) throw new Error('Authenticated user is required')
  const logicalKey=clean(logicalJobKey)||logicalExpertiseJobKey(job)
  const profile=clean(profileFingerprint)
  const engine=clean(engineVersion)
  const cacheKey=expertiseMatchCacheReference({userId:user,logicalJobKey:logicalKey,profileFingerprint:profile,engineVersion:engine})

  const {data:cached,error:readError}=await supabase
    .from('expertise_match_cache')
    .select('cache_key,analysis')
    .eq('cache_key',cacheKey)
    .eq('user_id',user)
    .maybeSingle()
  if(readError) throw new Error(`Expertise Match cache read failed: ${readError.message||'unknown Supabase error'}`)
  if(cached?.analysis&&typeof cached.analysis==='object'){
    return {analysis:cached.analysis,matchCacheKey:cacheKey,cacheHit:true}
  }

  const analysis=await analyze({job,cvText})
  if(!analysis||typeof analysis!=='object') throw new Error('Expertise Match analysis is invalid')

  const {error:writeError}=await supabase.from('expertise_match_cache').upsert({
    cache_key:cacheKey,
    user_id:user,
    logical_job_key:logicalKey,
    profile_fingerprint:profile,
    engine_version:engine,
    analysis,
    updated_at:new Date().toISOString(),
  })
  if(writeError) throw new Error(`Expertise Match cache write failed: ${writeError.message||'unknown Supabase error'}`)

  return {analysis,matchCacheKey:cacheKey,cacheHit:false}
}

export async function resolveManualExpertiseMatch({
  supabase,
  userId,
  job={},
  cvText,
  cvSourceVersion,
  profileState,
  analyze=analyzeExpertiseMatch,
}={}){
  if(typeof analyze!=='function') throw new Error('Expertise Match analyzer is required')
  const currentCv=clean(cvText)
  const storedCv=clean(profileState?.cv_text)
  const currentVersion=clean(cvSourceVersion)
  const storedVersion=clean(profileState?.cv_source_version)
  const profileFingerprint=clean(profileState?.profile_fingerprint)
  const sourceVersionMatches=!currentVersion||!storedVersion||currentVersion===storedVersion
  const cacheIdentityIsCurrent=Boolean(
    profileFingerprint&&storedCv&&currentCv&&storedCv===currentCv&&sourceVersionMatches
  )

  if(cacheIdentityIsCurrent){
    return getOrCreateExpertiseMatch({
      supabase,
      userId,
      job,
      cvText:currentCv,
      profileFingerprint,
      analyze,
    })
  }

  const analysis=await analyze({job,cvText:currentCv})
  if(!analysis||typeof analysis!=='object') throw new Error('Expertise Match analysis is invalid')
  return {
    analysis,
    matchCacheKey:null,
    logicalJobKey:logicalExpertiseJobKey(job),
    cacheHit:false,
  }
}
