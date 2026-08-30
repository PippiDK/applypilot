import { extractJobindexSearchRecords, extractJobindexDetail, extractJobindexExternalDetail, extractOracleCandidateExperienceDetail, jobindexDetailUrl } from './jobindex-parser.js'
import {
  DSB_CURRENT_JOBS_URL,
  dsbAppliedUrlForTitle,
  dsvSearchUrl,
  embeddedHrOnDescriptor,
  exactTitleJobHref,
  hrManagerAdvertisementUrl,
  hrOnCompanyIdFromScript,
  hrOnFrameUrl,
  hrOnRootFromScript,
  isDsbCareersUrl,
  isDsvCareersUrl,
  jobindexApplyTrackerUrl,
  jobindexCanonicalFullJd,
  jobindexCanonicalFullJdUrl,
} from './jobindex-retrieval-fallbacks.js'
import { normalizeJob } from './normalized-job.js'

const SEARCH_BASE='https://www.jobindex.dk/jobsoegning.rss'
const FULL_JD_MIN_LENGTH=500
const GENERIC_ROLE_TOKENS=new Set(['senior','sr','junior','jr','principal','global','regional','international','experienced','manager','lead','specialist','consultant','coordinator','director','head','officer','owner'])

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

function exactJobindexQuery(value){
  const query=String(value??'').trim().replace(/\s+/g,' ')
  if(!query) return ''
  if(/^"[^"]+"$/.test(query)||/[+]/.test(query)||/\b(?:AND|OR|NOT)\b/i.test(query)) return query
  return `"${query.replace(/"/g,' ').replace(/\s+/g,' ').trim()}"`
}

function searchUrl(query,page=1){
  const url=new URL(SEARCH_BASE)
  url.searchParams.set('q',exactJobindexQuery(query))
  if(page>1) url.searchParams.set('page',String(page))
  return url.toString()
}

function roleTokens(value=''){
  return String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a')
    .replace(/\bprogramme\b/g,'program').replace(/\bprogrammes\b/g,'programs')
    .replace(/[^a-z0-9+#.]+/g,' ').trim().split(/\s+/).filter(Boolean)
}
function tokenEquivalent(a,b){return a===b||`${a}s`===b||`${b}s`===a}
function discoveryTitleRelevant(record,direction){
  const title=String(record?.title??'').trim()
  if(!title) return true
  const approved=roleTokens(direction?.role||direction?.query).filter(token=>!GENERIC_ROLE_TOKENS.has(token))
  if(!approved.length) return true
  const candidate=roleTokens(title)
  return approved.some(token=>candidate.some(candidateToken=>tokenEquivalent(token,candidateToken)))
}

async function fetchPage(fetcher,url,options){
  const response=await fetcher(url,options)
  if(typeof response==='string') return {text:response,url:String(url)}
  if(!response?.ok) throw new Error(`Jobindex HTTP ${response?.status||'error'}`)
  return {text:await response.text(),url:String(response.url||url)}
}
async function fetchText(fetcher,url,options){return (await fetchPage(fetcher,url,options)).text}

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

function usableFullJd(value){return String(value??'').trim().length>=FULL_JD_MIN_LENGTH}

function oracleCandidateExperienceRequest(value){
  try{
    const url=new URL(String(value??''))
    if(!/(?:^|\.)oraclecloud\.com$/i.test(url.hostname)) return null
    const match=url.pathname.match(/^\/hcmUI\/CandidateExperience\/([^/]+)\/sites\/([^/]+)\/job\/([^/?#]+)/i)
    if(!match) return null
    const [,language,siteNumber,requisitionId]=match
    const api=new URL('/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',url.origin)
    api.searchParams.set('expand','all')
    api.searchParams.set('onlyData','true')
    api.searchParams.set('finder',`ById;Id="${requisitionId}",siteNumber=${siteNumber}`)
    return {url:api.toString(),language,siteNumber,requisitionId}
  }catch{return null}
}

export async function searchJobindexSource({freshnessDays=7,unionSearchPlan={},exclusionRules=[],filters={},fetcher=globalThis.fetch,maxPages=3}={}){
  const plan=directions(unionSearchPlan)
  if(!plan.length) return {source:'jobindex',status:'failed',jobs:[],stats:null,error:'Search Profile is required for Jobindex discovery.'}
  if(typeof fetcher!=='function') return {source:'jobindex',status:'failed',jobs:[],stats:null,error:'Jobindex fetcher unavailable.'}

  const byId=new Map()
  let searchRequests=0
  let searchFailures=0
  let discoveryTitleRejected=0
  let detailRequests=0
  let detailFailures=0
  let externalDetailRequests=0
  let externalDetailFailures=0
  let externalFetchFailures=0
  let externalParseMisses=0
  let oracleDetailRequests=0
  let oracleDetailFailures=0
  let oracleDetailVerified=0
  let fullJdVerified=0

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
        if(!discoveryTitleRelevant(record,direction)){
          discoveryTitleRejected++
          continue
        }
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
    const applicationUrl=detail.applicationUrl||jobindexApplyTrackerUrl(html)

    let fullJd=detail.fullJd||''
    let externalDetail=null
    const adoptDetail=parsed=>{
      if(!usableFullJd(parsed?.fullJd)) return false
      fullJd=parsed.fullJd
      externalDetail=parsed
      return true
    }

    if(!usableFullJd(fullJd)){
      const canonicalUrl=jobindexCanonicalFullJdUrl(html)
      if(canonicalUrl&&canonicalUrl!==detailUrl){
        try{
          const canonicalPage=await fetchPage(fetcher,canonicalUrl)
          const canonicalJd=jobindexCanonicalFullJd(canonicalPage.text)
          if(usableFullJd(canonicalJd)) fullJd=canonicalJd
        }catch{}
      }
    }

    let externalPage=null
    if(!usableFullJd(fullJd)&&applicationUrl){
      externalDetailRequests++
      try{
        externalPage=await fetchPage(fetcher,applicationUrl)
        const parsed=extractJobindexExternalDetail(externalPage.text,{url:externalPage.url})
        if(!adoptDetail(parsed)) externalParseMisses++
      }catch{
        externalFetchFailures++
      }

      if(!usableFullJd(fullJd)&&externalPage){
        const advertisementUrl=hrManagerAdvertisementUrl(externalPage.url)
        if(advertisementUrl){
          try{
            const advertisementPage=await fetchPage(fetcher,advertisementUrl)
            adoptDetail(extractJobindexExternalDetail(advertisementPage.text,{url:advertisementPage.url}))
          }catch{externalFetchFailures++}
        }
      }

      if(!usableFullJd(fullJd)&&externalPage){
        const embedded=embeddedHrOnDescriptor(applicationUrl,externalPage.text)
        if(embedded){
          try{
            const [hrScript,customerScript]=await Promise.all([
              fetchText(fetcher,embedded.hrScriptUrl),
              fetchText(fetcher,embedded.customerScriptUrl),
            ])
            const frameUrl=hrOnFrameUrl({
              root:hrOnRootFromScript(hrScript),
              companyId:hrOnCompanyIdFromScript(customerScript),
              jobId:embedded.jobId,
              locale:embedded.locale,
            })
            if(frameUrl){
              const framePage=await fetchPage(fetcher,frameUrl)
              adoptDetail(extractJobindexExternalDetail(framePage.text,{url:framePage.url}))
            }
          }catch{externalFetchFailures++}
        }
      }

      if(!usableFullJd(fullJd)&&isDsvCareersUrl(applicationUrl)){
        try{
          const searchPage=await fetchPage(fetcher,dsvSearchUrl(detail.title||candidate.title))
          const directUrl=exactTitleJobHref(searchPage.text,detail.title||candidate.title,'https://jobs.dsv.com/')
          if(directUrl){
            const directPage=await fetchPage(fetcher,directUrl)
            adoptDetail(extractJobindexExternalDetail(directPage.text,{url:directPage.url}))
          }
        }catch{externalFetchFailures++}
      }

      if(!usableFullJd(fullJd)&&isDsbCareersUrl(applicationUrl)){
        try{
          const listingPage=await fetchPage(fetcher,DSB_CURRENT_JOBS_URL)
          const directUrl=dsbAppliedUrlForTitle(listingPage.text,detail.title||candidate.title)
          if(directUrl){
            const directPage=await fetchPage(fetcher,directUrl)
            adoptDetail(extractJobindexExternalDetail(directPage.text,{url:directPage.url}))
          }
        }catch{externalFetchFailures++}
      }

      if(!usableFullJd(fullJd)){
        const oracleRequest=oracleCandidateExperienceRequest(applicationUrl)
        if(oracleRequest){
          oracleDetailRequests++
          try{
            const oraclePayload=await fetchText(fetcher,oracleRequest.url,{
              headers:{Accept:'application/json','Ora-Irc-Language':oracleRequest.language},
            })
            const oracleDetail=extractOracleCandidateExperienceDetail(oraclePayload,{url:applicationUrl})
            if(adoptDetail(oracleDetail)) oracleDetailVerified++
            else oracleDetailFailures++
          }catch{
            oracleDetailFailures++
          }
        }
      }

      if(!usableFullJd(fullJd)) externalDetailFailures++
    }

    const verified=usableFullJd(fullJd)
    if(verified) fullJdVerified++
    const postedDate=detail.postedDate||externalDetail?.postedDate||null
    return normalizeJob({
      ...detail,
      applicationUrl,
      title:detail.title||externalDetail?.title||candidate.title||'',
      company:detail.company||externalDetail?.company||'',
      location:detail.location||externalDetail?.location||'',
      country:detail.country||externalDetail?.country||'',
      remoteType:detail.remoteType||externalDetail?.remoteType||'',
      postedDate,
      sourceJobId:candidate.jobId,
      publishedAt:postedDate,
      fullJd:verified?fullJd:'',
      description:verified?fullJd:'',
      foundBy:candidate.foundBy,
      sourceRecords:[{
        source:'jobindex',
        sourceJobId:candidate.jobId,
        detailUrl:detail.detailUrl||detailUrl,
        applicationUrl,
        fullJd:verified?fullJd:'',
        limitedData:!verified,
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
      title:candidate.title||'',company:'',location:'',postedDate:null,publishedAt:null,fullJd:'',description:'',
      detailUrl:candidate.detailUrl||jobindexDetailUrl(candidate.jobId),
      foundBy:candidate.foundBy||[],
      sourceRecords:[{
        source:'jobindex',sourceJobId:candidate.jobId,
        detailUrl:candidate.detailUrl||jobindexDetailUrl(candidate.jobId),
        applicationUrl:'',fullJd:'',limitedData:true,
      }],
    }))
  }

  const limitedData=jobs.filter(job=>(job.sourceRecords||[]).some(record=>record?.limitedData===true)).length
  const inaccessible=searchFailures+detailFailures+externalDetailFailures+oracleDetailFailures
  const status=(inaccessible||limitedData)?'partial':'success'
  return {
    source:'jobindex',
    status,
    jobs,
    stats:{searchRequests,searchFailures,discoveryTitleRejected,detailRequests,detailFailures,externalDetailRequests,externalDetailFailures,externalFetchFailures,externalParseMisses,oracleDetailRequests,oracleDetailFailures,oracleDetailVerified,fullJdVerified,limitedData,discovered:candidates.length,returned:jobs.length,freshnessDays:Number(freshnessDays)||7},
    error:status==='partial'?'Some Jobindex vacancies could not be fully retrieved.':'',
    filters,
    exclusionRules,
  }
}
