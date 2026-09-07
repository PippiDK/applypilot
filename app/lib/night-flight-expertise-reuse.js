import {enrichSearchJobsWithNightFlight} from './night-flight-main-search-bridge.js'

export function resolveNightFlightExpertise({job,index}={}){
  if(!job||typeof job!=='object') return null
  const enriched=enrichSearchJobsWithNightFlight([{job}],index)
  const analysis=enriched[0]?.job?.nightFlight?.analysis
  return analysis&&typeof analysis==='object'?analysis:null
}
