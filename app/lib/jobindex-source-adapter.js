import { extractJobindexSearchRecords, extractJobindexDetail, jobindexDetailUrl } from './jobindex-parser.js'
import { normalizeJob } from './normalized-job.js'

const SEARCH_BASE='https://www.jobindex.dk/jobsoegning.rss'

function directions(plan={}){
  return (Array.isArray(plan?.directions)?plan.directions:[])
    .map(direction=>({
      ...direction,
      role:String(direction?.role??'').trim(),
      query:String(direction?.query||direction?.role||'').trim(),
      tier:direction?.tier==='primary'?'primary':'adjacent',
    }))
    .filter(direction=>direction.role&&direction.query)
}

function searchUrl(query,page=1){
  const url=new URL(SEARCH_BASE)
  url.searchParams.set('q',query)
  if(page>1) url.searchParams.set('page',String(page))
  return url.toString()
}

async function fetchText(fetcher,url){
  const response=await fetcher(url)
  if(typeof response==='string') return response
  if(!response?.ok) throw new Error(`Jobindex HTTP ${response?.status||'error'}`)
  return response.text()
}

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

function directionIdentity(direction){return `${direction.tier}|${direction.role}|${direction.query}`.toLowerCase()}
function mergeDirection(list,direction){
  const out=Array.isArray(list)?[...list]:[]
  const key=directionIdentity(direction)
  if(!out.some(item=>directionIdentity(item)===key)) out.push(direction)
  return out
}

export async function searchJobindexSource({freshnessDays=7,unionSearchPlan={},exclusionRules=[],filters={},fetcher=globalThis.fetch,maxPages=3}={}){
  const plan=directions(unionSearchPlan)
  if(!plan.length) return {source:'jobindex',status:'failed',jobs:[],stats:null,error:'Search Profile is required for Jobindex discovery.'}
  if(typeof fetcher!=='function') return {source:'jobindex',status:'failed',jobs:[],stats:null,error:'Jobindex fetcher unavailable.'}

  const byId=new Map()
  let searchRequests=0
  let searchFailures=0
  let detailRequests=0
  let detailFailures=0

  for(const direction of plan){
    const seenForDirection=new Set()
    for(let page=1;page<=Math.max(1,Number(maxPages)||1);page++){
      let records=[]
      try{
        searchRequests++
        const html=await fetchText(fetcher,searchUrl(direction.query,page))
        records=extractJobindexSearchRecords(html)
      }catch{
        searchFailures++
        break
      }
      if(!records.length) break
      let newIds=0
      for(const record of records){
        if(seenForDirection.has(record.jobId)) continue
        seenForDirection.add(record.jobId)
        newIds++
        const current=byId.get(record.jobId)||{...record,foundBy:[]}
        current.foundBy=mergeDirection(current.foundBy,direction)
        byId.set(record.jobId,current)
      }
      if(!newIds) break
    }
  }

  const candidates=[...byId.values()]
  const settled=await mapLimit(candidates,4,async candidate=>{
    detailRequests++
    const detailUrl=candidate.detailUrl||jobindexDetailUrl(candidate.jobId)
    const html=await fetchText(fetcher,detailUrl)
    const detail=extractJobindexDetail(html,{jobId:candidate.jobId})
    return normalizeJob({
      ...detail,
      sourceJobId:candidate.jobId,
      publishedAt:detail.postedDate,
      description:detail.fullJd,
      foundBy:candidate.foundBy,
      sourceRecords:[{
        source:'jobindex',
        sourceJobId:candidate.jobId,
        detailUrl:detail.detailUrl||detailUrl,
        applicationUrl:detail.applicationUrl||'',
        fullJd:detail.fullJd||'',
        limitedData:false,
      }],
    })
  })

  const jobs=[]
  for(const item of settled){
    if(item.status==='fulfilled'){
      jobs.push(item.value)
      continue
    }
    detailFailures++
    const candidate=item.item||{}
    jobs.push(normalizeJob({
      sourceJobId:candidate.jobId,
      jobId:`jobindex:${candidate.jobId}`,
      title:'',company:'',location:'',postedDate:null,publishedAt:null,fullJd:'',description:'',
      detailUrl:candidate.detailUrl||jobindexDetailUrl(candidate.jobId),
      foundBy:candidate.foundBy||[],
      sourceRecords:[{
        source:'jobindex',sourceJobId:candidate.jobId,
        detailUrl:candidate.detailUrl||jobindexDetailUrl(candidate.jobId),
        applicationUrl:'',fullJd:'',limitedData:true,
      }],
    }))
  }

  const inaccessible=searchFailures+detailFailures
  const status=inaccessible?'partial':'success'
  return {
    source:'jobindex',
    status,
    jobs,
    stats:{searchRequests,searchFailures,detailRequests,detailFailures,discovered:candidates.length,returned:jobs.length,freshnessDays:Number(freshnessDays)||7},
    error:status==='partial'?'Some Jobindex vacancies could not be fully retrieved.':'',
    filters,
    exclusionRules,
  }
}
