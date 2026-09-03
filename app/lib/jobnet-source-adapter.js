import { normalizeJob } from './normalized-job.js'

const BASE='https://jobnet.dk/bff'
const SEARCH='/FindJob/Search'
const DETAIL='/FindJob/JobAdDetails/'
const FULL_JD_MIN_LENGTH=500
const GENERIC=new Set(['senior','sr','junior','jr','principal','global','regional','international','experienced','manager','lead','specialist','consultant','coordinator','director','head','officer','owner'])

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function plain(html=''){
  return clean(String(html??'')
    .replace(/<!--[sS]*?-->/g,' ')
    .replace(/<script\b[sS]*?<\/script>/gi,' ')
    .replace(/<style\b[sS]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>'))
}
function canonical(value=''){
  return String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a')
    .replace(/\bprogramme\b/g,'program')
    .replace(/\bprojektleder(?:en|e)?\b/g,'project manager')
    .replace(/\bprojektledelse\b/g,'project management')
    .replace(/\bprojekt(?:er)?\b/g,'project')
    .replace(/\bleveranceleder(?:en|e)?\b/g,'delivery manager')
    .replace(/\bleveranceledelse\b/g,'delivery management')
    .replace(/\bimplementering(?:en)?\b/g,'implementation')
    .replace(/\bdigitalisering(?:en)?\b/g,'digital')
    .replace(/\bteknologi(?:en)?\b/g,'technology')
    .replace(/\bteknisk(?:e)?\b/g,'technical')
    .replace(/\bintegrationer\b/g,'integration')
    .replace(/\bsystemer\b/g,'system')
    .replace(/\bplatforme\b/g,'platform')
    .replace(/[^a-z0-9+#.]+/g,' ')
    .trim()
}
function tokens(value=''){return canonical(value).split(/\s+/).filter(Boolean)}
function titleRelevant(title,direction={}){
  const candidate=new Set(tokens(title))
  const basis=clean(direction.query||direction.role)
  const approved=tokens(basis).filter(token=>!GENERIC.has(token))
  if(!approved.length) return true
  return approved.some(token=>candidate.has(token)||candidate.has(token+'s')||(token.endsWith('s')&&candidate.has(token.slice(0,-1))))
}
function directions(plan={}){
  return (Array.isArray(plan?.directions)?plan.directions:[])
    .map(direction=>({...direction,role:clean(direction?.role),query:clean(direction?.query||direction?.role),tier:direction?.tier==='primary'?'primary':'adjacent'}))
    .filter(direction=>direction.role&&direction.query)
}
function directionKey(direction={}){return [direction.tier,direction.role,direction.query].map(value=>clean(value).toLowerCase()).join('|')}
function mergeDirection(list,direction){
  const out=Array.isArray(list)?[...list]:[]
  const key=directionKey(direction)
  if(!out.some(item=>directionKey(item)===key)) out.push(direction)
  return out
}
function denmarkDateKey(value){
  const date=value instanceof Date?value:new Date(value)
  if(!Number.isFinite(date.getTime())) return null
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const part=type=>parts.find(item=>item.type===type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function withinFreshness(value,days,now=new Date()){
  if(!value) return false
  const published=new Date(value)
  if(!Number.isFinite(published.getTime())) return false
  if(Number(days)===1) return denmarkDateKey(published)===denmarkDateKey(now)
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  const posted=Date.UTC(published.getUTCFullYear(),published.getUTCMonth(),published.getUTCDate())
  const age=Math.floor((today-posted)/86400000)
  return age>=0&&age<=Number(days)
}
async function apiFetch(fetcher,path,params={}){
  const url=new URL(BASE+path)
  for(const [key,value] of Object.entries(params)) if(value!==null&&value!==undefined&&String(value)!=='') url.searchParams.set(key,String(value))
  const response=await fetcher(url.toString(),{headers:{'x-csrf':'1','accept':'application/json'}})
  if(!response?.ok) throw new Error(`Jobnet HTTP ${response?.status||'error'}`)
  return response.json()
}
async function mapLimit(items,limit,fn){
  const results=new Array(items.length);let next=0
  async function worker(){while(true){const index=next++;if(index>=items.length)return;try{results[index]={status:'fulfilled',value:await fn(items[index],index)}}catch(reason){results[index]={status:'rejected',reason,item:items[index]}}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return results
}

export async function searchJobnetSource({freshnessDays=7,unionSearchPlan={},fetcher=globalThis.fetch,maxPages=2,resultsPerPage=20,dependencies={}}={}){
  let discoverySearchPlan=unionSearchPlan
  if(typeof dependencies?.buildDiscoverySearchPlan==='function'){
    try{discoverySearchPlan=await dependencies.buildDiscoverySearchPlan({unionSearchPlan})}catch{discoverySearchPlan=unionSearchPlan}
  }
  const plan=directions(discoverySearchPlan)
  if(!plan.length) return {source:'jobnet',status:'failed',jobs:[],stats:null,error:'Search Profile is required for Jobnet discovery.'}
  if(typeof fetcher!=='function') return {source:'jobnet',status:'failed',jobs:[],stats:null,error:'Jobnet fetcher unavailable.'}

  const byId=new Map()
  let searchRequests=0,searchFailures=0,discoveryTitleRejected=0
  const now=new Date()

  for(const direction of plan){
    for(let page=1;page<=Math.max(1,Number(maxPages)||1);page++){
      let data
      try{
        searchRequests++
        data=await apiFetch(fetcher,SEARCH,{searchString:direction.query,resultsPerPage,pageNumber:page,orderType:'PublicationDate'})
      }catch{searchFailures++;break}
      const records=Array.isArray(data?.jobAds)?data.jobAds:[]
      if(!records.length) break
      let freshOnPage=0
      for(const record of records){
        if(!withinFreshness(record?.publicationDate,freshnessDays,now)) continue
        freshOnPage++
        if(!titleRelevant(record?.title,direction)){discoveryTitleRejected++;continue}
        const id=clean(record?.jobAdId)
        if(!id) continue
        const current=byId.get(id)||{record,foundBy:[]}
        current.foundBy=mergeDirection(current.foundBy,direction)
        byId.set(id,current)
      }
      if(freshOnPage===0) break
    }
  }

  const candidates=[...byId.entries()].map(([jobAdId,value])=>({jobAdId,...value}))
  let detailRequests=0,detailFailures=0,fullJdVerified=0
  const settled=await mapLimit(candidates,4,async candidate=>{
    detailRequests++
    const detail=await apiFetch(fetcher,DETAIL+encodeURIComponent(candidate.jobAdId),{incrementViews:'false'})
    const fullJd=plain(detail?.body||'')
    if(fullJd.length>=FULL_JD_MIN_LENGTH) fullJdVerified++
    const address=detail?.job?.address||{}
    const location=clean(address.city||address.municipality||candidate.record?.postalDistrictName||candidate.record?.municipality||'')
    const applicationUrl=clean(detail?.application?.url||'')
    const originalUrl=`https://jobnet.dk/find-job/${candidate.jobAdId}`
    const publishedAt=detail?.publicationDateTime||candidate.record?.publicationDate||null
    const deadline=detail?.application?.deadlineDate||candidate.record?.applicationDeadline||null
    const vacancyStatus=deadline&&new Date(deadline).getTime()<Date.now()?'CLOSED':'OPEN'
    return normalizeJob({
      source:'jobnet',
      sourceJobId:candidate.jobAdId,
      jobId:`jobnet:${candidate.jobAdId}`,
      title:clean(detail?.title||candidate.record?.title),
      company:clean(detail?.employer?.name||candidate.record?.hiringOrgName),
      location,
      country:clean(address.countryName||candidate.record?.country||'Danmark'),
      publishedAt,
      postedDate:publishedAt,
      applicationDeadline:deadline,
      vacancyStatus,
      employmentType:detail?.job?.isLimitedPeriod?'Temporary':'Permanent',
      fullJd:fullJd.length>=FULL_JD_MIN_LENGTH?fullJd:'',
      description:fullJd.length>=FULL_JD_MIN_LENGTH?fullJd:'',
      originalUrl,
      detailUrl:originalUrl,
      applicationUrl:applicationUrl||originalUrl,
      foundBy:candidate.foundBy,
      sourceRecords:[{
        source:'jobnet',
        sourceJobId:candidate.jobAdId,
        detailUrl:originalUrl,
        applicationUrl:applicationUrl||originalUrl,
        fullJd:fullJd.length>=FULL_JD_MIN_LENGTH?fullJd:'',
        limitedData:fullJd.length<FULL_JD_MIN_LENGTH,
      }],
    })
  })

  const jobs=[]
  for(const item of settled){
    if(item.status==='fulfilled'){jobs.push(item.value);continue}
    detailFailures++
  }
  const limitedData=jobs.filter(job=>(job.sourceRecords||[]).some(record=>record?.limitedData===true)).length
  const status=(searchFailures||detailFailures||limitedData)?'partial':'success'
  return {
    source:'jobnet',
    status,
    jobs,
    stats:{searchRequests,searchFailures,discoveryTitleRejected,detailRequests,detailFailures,fullJdVerified,limitedData,discovered:candidates.length,returned:jobs.length,freshnessDays:Number(freshnessDays)||7},
    error:status==='partial'?'Some Jobnet vacancies could not be fully retrieved.':'',
  }
}
