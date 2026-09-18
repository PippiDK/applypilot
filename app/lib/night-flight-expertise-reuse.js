import {enrichSearchJobsWithNightFlight} from './night-flight-main-search-bridge.js'

const clean=value=>String(value??'').trim()

export function resolveNightFlightExpertise({job,index,sourceVersion}={}){
  if(!job||typeof job!=='object') return null
  const enriched=enrichSearchJobsWithNightFlight([{job}],index)
  const nightFlight=enriched[0]?.job?.nightFlight
  const analysis=nightFlight?.analysis
  if(!analysis||typeof analysis!=='object') return null
  const currentSourceVersion=clean(sourceVersion)
  const savedSourceVersion=clean(nightFlight?.cvSourceVersion)
  if(!currentSourceVersion||!savedSourceVersion||currentSourceVersion!==savedSourceVersion) return null
  return analysis
}
