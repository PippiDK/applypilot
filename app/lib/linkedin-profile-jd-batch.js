import {parseDetailHtml} from './linkedin-search.js'
import {evaluateProfileJob} from './linkedin-profile-evaluator.js'

const LINKEDIN_JOB_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'

export async function runProfileJdBatch({candidates=[],fetcher,freshnessDays=7,exclusionRules=[],now=new Date(),maxCandidates=30,safeBudgetMs=45000,clock=()=>Date.now()}={}){
  if(typeof fetcher!=='function') throw new Error('Profile JD batch fetcher is required.')
  const input=Array.isArray(candidates)?candidates:[]
  const limit=Math.min(30,Math.max(1,Math.floor(Number(maxCandidates)||30)))
  const budget=Math.max(1,Number(safeBudgetMs)||45000)
  const startedAt=clock()
  const processed=[]
  const jobs=[]
  let accessLimited=false
  let fullJdVerified=0
  let evaluatedCandidates=0

  for(let index=0;index<input.length&&processed.length<limit;index++){
    if(processed.length>0 && clock()-startedAt>=budget) break
    const candidate=input[index]
    try{
      const html=await fetcher(`${LINKEDIN_JOB_DETAIL}${candidate.jobId}`)
      const job=parseDetailHtml(candidate,html,now)
      if(!job){
        accessLimited=true
        processed.push({
          candidate,
          detailStatus:'UNVERIFIED',
          job:null,
          evaluation:null,
          audit:{stage:'FULL_JD_UNVERIFIED',decision:'UNVERIFIED',reason:'Full Job Description could not be verified'},
          error:'Full Job Description could not be verified',
        })
        continue
      }

      fullJdVerified++
      const outcome=evaluateProfileJob({candidate,job,freshnessDays,exclusionRules,now})
      if(outcome.evaluated) evaluatedCandidates++
      const row={
        candidate,
        detailStatus:'PROCESSED',
        job,
        evaluation:outcome.evaluation,
        audit:{stage:outcome.stage,decision:outcome.decision,reason:outcome.reason,...(outcome.score==null?{}:{score:outcome.score})},
        error:null,
      }
      processed.push(row)
      if(outcome.keep) jobs.push({job,evaluation:outcome.evaluation})
    }catch(error){
      accessLimited=true
      processed.push({
        candidate,
        detailStatus:'UNVERIFIED',
        job:null,
        evaluation:null,
        audit:{stage:'DETAIL_FETCH_FAILED',decision:'UNVERIFIED',reason:'Full Job Description could not be retrieved'},
        error:String(error?.message||error||'LinkedIn detail request failed'),
      })
    }
  }

  const remaining=input.slice(processed.length)
  jobs.sort((a,b)=>b.evaluation.score-a.evaluation.score||(new Date(b.job.publishedAt||0)-new Date(a.job.publishedAt||0)))
  return {
    processed,
    remaining,
    jobs,
    accessLimited,
    complete:remaining.length===0,
    stats:{processed:processed.length,remaining:remaining.length,fullJdVerified,evaluatedCandidates,kept:jobs.length},
  }
}
