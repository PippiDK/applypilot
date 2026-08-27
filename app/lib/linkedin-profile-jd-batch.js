import {parseDetailHtml} from './linkedin-search.js'
import {evaluateSemanticRoleBatch} from './profile-semantic-role-match.js'
import {evaluateProfilePrecheck,semanticInputForCandidate,applySemanticProfileMatch} from './linkedin-profile-evaluator.js'

const LINKEDIN_JOB_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'

function chunks(items,size=8){
  const result=[]
  for(let i=0;i<items.length;i+=size) result.push(items.slice(i,i+size))
  return result
}

export async function runProfileJdBatch({
  candidates=[],fetcher,freshnessDays=7,exclusionRules=[],now=new Date(),
  maxCandidates=30,safeBudgetMs=45000,clock=()=>Date.now(),modelCall
}={}){
  if(typeof fetcher!=='function') throw new Error('Profile JD batch fetcher is required.')
  const input=Array.isArray(candidates)?candidates:[]
  const limit=Math.min(30,Math.max(1,Math.floor(Number(maxCandidates)||30)))
  const budget=Math.max(1,Number(safeBudgetMs)||45000)
  const startedAt=clock()
  const slots=[]
  const semanticQueue=[]
  const jobs=[]
  let accessLimited=false
  let fullJdVerified=0
  let evaluatedCandidates=0
  let fetchedCount=0

  for(let index=0;index<input.length&&fetchedCount<limit;index++){
    if(fetchedCount>0 && clock()-startedAt>=budget) break
    const candidate=input[index]
    const slotIndex=fetchedCount
    fetchedCount++
    try{
      const html=await fetcher(`${LINKEDIN_JOB_DETAIL}${candidate.jobId}`)
      const job=parseDetailHtml(candidate,html,now)
      if(!job){
        accessLimited=true
        slots[slotIndex]={
          candidate,
          detailStatus:'UNVERIFIED',
          job:null,
          evaluation:null,
          audit:{stage:'FULL_JD_UNVERIFIED',decision:'UNVERIFIED',reason:'Full Job Description could not be verified'},
          error:'Full Job Description could not be verified',
        }
        continue
      }

      fullJdVerified++
      const precheck=evaluateProfilePrecheck({job,freshnessDays,exclusionRules,now})
      if(!precheck.pass){
        if(precheck.decision==='UNVERIFIED') accessLimited=true
        slots[slotIndex]={
          candidate,
          detailStatus:precheck.decision==='UNVERIFIED'?'UNVERIFIED':'PROCESSED',
          job,
          evaluation:null,
          audit:{stage:precheck.stage,decision:precheck.decision,reason:precheck.reason},
          error:precheck.decision==='UNVERIFIED'?precheck.reason:null,
        }
        continue
      }

      semanticQueue.push({
        slotIndex,
        candidate,
        job,
        semanticInput:semanticInputForCandidate({candidate,job}),
      })
    }catch(error){
      accessLimited=true
      slots[slotIndex]={
        candidate,
        detailStatus:'UNVERIFIED',
        job:null,
        evaluation:null,
        audit:{stage:'DETAIL_FETCH_FAILED',decision:'UNVERIFIED',reason:'Full Job Description could not be retrieved'},
        error:String(error?.message||error||'LinkedIn detail request failed'),
      }
    }
  }

  for(const chunk of chunks(semanticQueue,8)){
    try{
      const semanticResults=await evaluateSemanticRoleBatch({
        items:chunk.map(row=>row.semanticInput),
        modelCall
      })
      const byJobId=new Map(semanticResults.map(result=>[result.jobId,result]))
      for(const row of chunk){
        const semantic=byJobId.get(String(row.candidate.jobId))
        const outcome=applySemanticProfileMatch({candidate:row.candidate,job:row.job,semantic})
        if(outcome.evaluated) evaluatedCandidates++
        slots[row.slotIndex]={
          candidate:row.candidate,
          detailStatus:'PROCESSED',
          job:row.job,
          evaluation:outcome.evaluation,
          audit:{stage:outcome.stage,decision:outcome.decision,reason:outcome.reason,...(outcome.score==null?{}:{score:outcome.score})},
          error:null,
        }
        if(outcome.keep) jobs.push({job:row.job,evaluation:outcome.evaluation})
      }
    }catch(error){
      accessLimited=true
      for(const row of chunk){
        slots[row.slotIndex]={
          candidate:row.candidate,
          detailStatus:'UNVERIFIED',
          job:row.job,
          evaluation:null,
          audit:{stage:'SEMANTIC_EVALUATION_UNVERIFIED',decision:'UNVERIFIED',reason:'Vacancy relevance could not be semantically verified'},
          error:String(error?.message||'Semantic vacancy evaluation failed')
        }
      }
    }
  }

  const processed=slots.filter(Boolean)
  const remaining=input.slice(fetchedCount)
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
