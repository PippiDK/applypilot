import {parseDetailHtml as defaultParseDetailHtml} from './linkedin-search.js'
import {searchLinkedInShadow as defaultSearchLinkedInShadow} from './linkedin-shadow-discovery.js'

const LINKEDIN_JOB_DETAIL='https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'

async function mapLimit(items,limit,fn){
  const results=new Array(items.length)
  let next=0
  async function worker(){
    while(true){
      const index=next++
      if(index>=items.length) return
      try{results[index]={status:'fulfilled',value:await fn(items[index],index)}}
      catch(reason){results[index]={status:'rejected',reason,item:items[index]}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return results
}

export async function acquireLinkedInProfileJobs({freshnessDays=7,unionSearchPlan={},fetcher,now=new Date(),dependencies={}}={}){
  const searchLinkedInShadow=dependencies.searchLinkedInShadow||defaultSearchLinkedInShadow
  const parseDetailHtml=dependencies.parseDetailHtml||defaultParseDetailHtml
  if(typeof fetcher!=='function') throw new Error('Profile-driven LinkedIn fetcher is required.')
  if(!Array.isArray(unionSearchPlan?.directions)||unionSearchPlan.directions.length===0) throw new Error('Search Profile requires at least one role direction.')

  const discovery=await searchLinkedInShadow({freshnessDays,unionSearchPlan,fetcher})
  let detailRequests=0
  let detailFailures=0
  let incompleteDetails=0
  const jobs=[]

  const settled=await mapLimit(discovery.candidates||[],4,async candidate=>{
    detailRequests++
    const html=await fetcher(`${LINKEDIN_JOB_DETAIL}${candidate.jobId}`)
    const job=parseDetailHtml(candidate,html,now)
    return {candidate,job}
  })

  for(const item of settled){
    if(item.status==='rejected'){
      detailFailures++
      continue
    }
    const {candidate,job}=item.value
    if(!job){incompleteDetails++;continue}
    jobs.push({...job,foundBy:Array.isArray(candidate.foundBy)?candidate.foundBy:[]})
  }

  const inaccessible=Number(discovery.stats?.searchFailures||0)+detailFailures+incompleteDetails
  return {
    source:'linkedin',
    status:inaccessible?'partial':'success',
    jobs,
    stats:{...discovery.stats,detailRequests,detailFailures,incompleteDetails,fullJdVerified:jobs.length,acquired:jobs.length},
    coverage:discovery.coverage??null,
    audit:[],
    error:inaccessible?'Some LinkedIn vacancies could not be fully retrieved.':'',
  }
}
