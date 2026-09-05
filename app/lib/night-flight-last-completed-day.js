import {loadLatestNightFlightProfileState} from './night-flight-profile-store.js'
import {loadNightFlightSettings} from './night-flight-settings-store.js'
import {validateNightFlightSettings} from './night-flight-settings.js'
import {filterItemsByFreshnessSelection,previousCopenhagenDateKey} from './freshness-selection.js'
import {buildDiscoverySearchPlan} from './search-query-expansion-ai.js'
import {createLinkedInStableFetcher} from './linkedin-stable-fetcher.js'
import {searchLinkedInProfile} from './linkedin-profile-search.js'
import {searchJobindexSource} from './jobindex-source-adapter.js'
import {searchJobnetSource} from './jobnet-source-adapter.js'
import {evaluateProfileJob} from './job-profile-evaluator.js'
import {jobnetRoleContextGuard} from './jobnet-role-context-guard.js'

const PREVIOUS_DAY_REQUEST_DAYS=3
const OFFICIAL_SOURCES=['linkedin','jobindex','jobnet']

const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const identityText=value=>clean(value).toLowerCase().replace(/\b(a\/s|as)\b/g,'').replace(/[^a-z0-9æøå]+/g,' ').replace(/\s+/g,' ').trim()

function sourceOf(item={},fallback=''){
  const job=item?.job||item||{}
  return clean(job.source||job.sourceRecords?.[0]?.source||fallback).toLowerCase()
}

function sourceIdOf(item={}){
  const job=item?.job||item||{}
  return clean(job.sourceJobId||job.sourceRecords?.[0]?.sourceJobId)
}

function stableKey(item={},fallbackSource=''){
  const source=sourceOf(item,fallbackSource)
  const sourceJobId=sourceIdOf(item)
  return source&&sourceJobId?`${source}:${sourceJobId}`:''
}

function logicalKey(item={}){
  const job=item?.job||item||{}
  const company=identityText(job.company)
  const title=identityText(job.title)
  const location=identityText(job.location)
  return company&&title?`${company}|${title}|${location}`:''
}

function jdLength(item={}){
  const job=item?.job||item||{}
  return clean(job.fullJd||job.description).length
}

function mergeSourceRecords(...groups){
  const output=[]
  const seen=new Set()
  for(const group of groups){
    for(const record of Array.isArray(group)?group:[]){
      const key=[clean(record?.source).toLowerCase(),clean(record?.sourceJobId),clean(record?.detailUrl)].join('|')
      if(!key.replace(/\|/g,'')||seen.has(key)) continue
      seen.add(key)
      output.push({...record})
    }
  }
  return output
}

function cloneDiscoveryItem(item,source){
  const job=item?.job||item||{}
  const normalizedSource=sourceOf(item,source)
  return {
    ...(item?.job?item:{}),
    job:{
      ...job,
      sourceRecords:mergeSourceRecords(job.sourceRecords),
    },
    nightFlightSources:normalizedSource?[normalizedSource]:[],
  }
}

function mergeItems(current,incoming){
  const richer=jdLength(incoming)>jdLength(current)?incoming:current
  const other=richer===incoming?current:incoming
  return {
    ...richer,
    job:{
      ...richer.job,
      sourceRecords:mergeSourceRecords(current.job?.sourceRecords,incoming.job?.sourceRecords),
    },
    nightFlightSources:[...new Set([...(current.nightFlightSources||[]),...(incoming.nightFlightSources||[])])],
    evaluation:richer.evaluation||other.evaluation||null,
  }
}

export function mergeNightFlightDiscovery(sourceResults=[]){
  const output=[]
  const stableIndexes=new Map()
  const logicalIndexes=new Map()

  for(const group of Array.isArray(sourceResults)?sourceResults:[]){
    const source=clean(group?.source).toLowerCase()
    for(const raw of Array.isArray(group?.jobs)?group.jobs:[]){
      const incoming=cloneDiscoveryItem(raw,source)
      const stable=stableKey(incoming,source)
      const logical=logicalKey(incoming)
      const index=stableIndexes.get(stable)??logicalIndexes.get(logical)

      if(index===undefined){
        const nextIndex=output.length
        output.push(incoming)
        if(stable) stableIndexes.set(stable,nextIndex)
        if(logical) logicalIndexes.set(logical,nextIndex)
        continue
      }

      const merged=mergeItems(output[index],incoming)
      output[index]=merged
      const mergedStable=stableKey(merged,source)
      const mergedLogical=logicalKey(merged)
      if(stable) stableIndexes.set(stable,index)
      if(mergedStable) stableIndexes.set(mergedStable,index)
      if(logical) logicalIndexes.set(logical,index)
      if(mergedLogical) logicalIndexes.set(mergedLogical,index)
    }
  }

  return output
}

function limitedJob(job={}){
  return (Array.isArray(job.sourceRecords)?job.sourceRecords:[]).some(record=>record?.limitedData===true)||!clean(job.fullJd||job.description)
}

function evaluateOfficialSource(sourceResult,{searchPlan,exclusionRules,now,jobnetGuard=false}={}){
  const jobs=[]
  for(const job of Array.isArray(sourceResult?.jobs)?sourceResult.jobs:[]){
    if(limitedJob(job)) continue
    if(jobnetGuard&&!jobnetRoleContextGuard(job).pass) continue
    const result=evaluateProfileJob({
      job,
      foundBy:job.foundBy,
      exclusionRules,
      freshnessDays:PREVIOUS_DAY_REQUEST_DAYS,
      now,
    })
    if(result.pass) jobs.push({job,evaluation:result.evaluation})
  }
  jobs.sort((a,b)=>Number(b.evaluation?.score||0)-Number(a.evaluation?.score||0)||(new Date(b.job?.publishedAt||0)-new Date(a.job?.publishedAt||0)))
  return {...sourceResult,jobs}
}

function defaultSourceRunners(){
  return {
    linkedin:async({freshnessDays,discoverySearchPlan,exclusionRules,now})=>searchLinkedInProfile({
      freshnessDays,
      unionSearchPlan:discoverySearchPlan,
      exclusionRules,
      previousCandidates:[],
      previousVerifiedJobs:[],
      fetcher:createLinkedInStableFetcher(),
      now,
    }),
    jobindex:async({freshnessDays,discoverySearchPlan,exclusionRules,now})=>{
      const result=await searchJobindexSource({
        freshnessDays,
        unionSearchPlan:discoverySearchPlan,
        exclusionRules,
        filters:{},
        fetcher:globalThis.fetch,
      })
      return evaluateOfficialSource(result,{searchPlan:discoverySearchPlan,exclusionRules,now})
    },
    jobnet:async({freshnessDays,discoverySearchPlan,exclusionRules,now})=>{
      const result=await searchJobnetSource({
        freshnessDays,
        unionSearchPlan:discoverySearchPlan,
        fetcher:globalThis.fetch,
      })
      return evaluateOfficialSource(result,{searchPlan:discoverySearchPlan,exclusionRules,now,jobnetGuard:true})
    },
  }
}

function deepFreeze(value,seen=new WeakSet()){
  if(!value||typeof value!=='object'||seen.has(value)) return value
  seen.add(value)
  for(const child of Object.values(value)) deepFreeze(child,seen)
  return Object.freeze(value)
}

export function lastCompletedCopenhagenDate(now=new Date()){
  const target=previousCopenhagenDateKey(now)
  if(!target) throw new Error('Night Flight run time is invalid')
  return target
}

export async function runNightFlightLastCompletedDayDiscovery({
  supabase,
  userId,
  now=new Date(),
  sourceRunners,
}={}){
  const current=now instanceof Date?now:new Date(now)
  if(!Number.isFinite(current.getTime())) throw new Error('Night Flight run time is invalid')

  const profile=await loadLatestNightFlightProfileState({supabase,userId})
  if(!profile) throw new Error('Night Flight profile is not available')

  const settings=validateNightFlightSettings(await loadNightFlightSettings({supabase,userId}))
  if(!settings.sources.length) throw new Error('Select at least one source.')

  const searchProfile=profile.search_profile||{}
  const unionSearchPlan=searchProfile.unionSearchPlan||{}
  if(!Array.isArray(unionSearchPlan.directions)||unionSearchPlan.directions.length===0){
    throw new Error('Night Flight Search Profile requires at least one role direction')
  }

  const discoverySearchPlan=await buildDiscoverySearchPlan({unionSearchPlan})
  const exclusionRules=Array.isArray(searchProfile.exclusionRules)?searchProfile.exclusionRules:[]
  const runners=sourceRunners||defaultSourceRunners()
  const sourceResults=[]

  for(const source of settings.sources){
    if(!OFFICIAL_SOURCES.includes(source)) continue
    const runner=runners[source]
    if(typeof runner!=='function') throw new Error(`Night Flight source runner is not available: ${source}`)
    const result=await runner({
      freshnessDays:PREVIOUS_DAY_REQUEST_DAYS,
      profile,
      searchProfile,
      discoverySearchPlan,
      exclusionRules,
      now:current,
    })
    sourceResults.push({
      ...(result&&typeof result==='object'?result:{}),
      source,
      jobs:filterItemsByFreshnessSelection(result?.jobs||[],'yesterday',current),
    })
  }

  const batch={
    targetDate:lastCompletedCopenhagenDate(current),
    profileFingerprint:clean(profile.profile_fingerprint),
    sourcesSnapshot:[...settings.sources],
    areasSnapshot:[...settings.areas],
    jobs:mergeNightFlightDiscovery(sourceResults),
    sourceResults,
    frozenAt:current.toISOString(),
  }

  return deepFreeze(batch)
}
