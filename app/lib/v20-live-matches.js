import {mergeBrowserJobs} from './v20-browser-import.js'
import {collectorJobsToApplyPilotJobs} from './v20-browser-adapter.js'
import {evaluateProfileJob} from './job-profile-evaluator.js'

export const V20_LIVE_IMPORT_KEY='auvraen-v20-live-import-v1'

export function mergeImportedSourceJobs(existing=[],incoming=[]){
  return mergeBrowserJobs(existing,incoming)
}

function unevaluated(){
  // Live Matches expects an evaluation object; null is not a score.
  return {score:null,verdict:'Not rated',action:'Review',match:[],gaps:[],hardExclusion:false,breakdown:{}}
}

export function importedJobsToLiveItems(imported=[],profile={},freshnessDays=3){
  const jobs=collectorJobsToApplyPilotJobs(imported)
  return jobs.map(job=>{
    const directions=Array.isArray(profile?.unionSearchPlan?.directions)?profile.unionSearchPlan.directions:[]
    const result=job.publishedAt&&directions.length?evaluateProfileJob({
      job,
      foundBy:directions,
      exclusionRules:Array.isArray(profile?.exclusionRules)?profile.exclusionRules:[],
      freshnessDays
    }):null
    // Do not discard manually collected vacancies solely due to missing timestamps.
    return {job,evaluation:result?.evaluation||unevaluated()}
  })
}

export function combineImportedAndSearchItems(imported=[],searched=[]){
  const out=[]
  const seen=new Set()
  // Imported LinkedIn Job IDs win; other source records keep their search behavior.
  for(const item of [...imported,...searched]){
    const id=String(item?.job?.sourceJobId||'').trim()
    const source=String(item?.job?.source||'').toLowerCase()
    const key=source==='linkedin'&&id?'linkedin:'+id:''
    if(key&&seen.has(key))continue
    if(key)seen.add(key)
    out.push(item)
  }
  return out
}
