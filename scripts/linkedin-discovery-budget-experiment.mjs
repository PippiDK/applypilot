/**
 * Read-only A/B LinkedIn discovery experiment.
 * Run ONLY in manually reviewed GitHub PR workflow; no database or AI requests.
 * Counts discovery job IDs by posting age. It does not claim full LinkedIn coverage.
 */
import {searchLinkedInShadow} from '../app/lib/linkedin-shadow-discovery.js'
import {createLinkedInStableFetcher} from '../app/lib/linkedin-stable-fetcher.js'

const queries=[
 'Senior IT Project Manager','Technical Project Manager','Programme Manager',
 'IT Delivery Manager','IT Program Manager','Transformation Manager',
 'Implementation Manager','ERP Project Manager','D365 Project Manager',
 'Infrastructure Project Manager','IT Project Lead','Technical Program Manager'
]
const plan={directions:queries.map((role,index)=>({role,key:'ab-'+index,tier:'primary',origin:'manual'}))}
const dateKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
const reference=new Date()
function dayAge(value){
 if(!value)return null
 const d=new Date(value)
 if(!Number.isFinite(d.getTime()))return null
 const a=Date.parse(dateKey(reference)+'T12:00:00Z')
 const b=Date.parse(dateKey(d)+'T12:00:00Z')
 return Math.round((a-b)/86400000)
}
const all={}
for(const trial of [
 {name:'baseline_64_requests_4_pages',maxSearchRequests:64,maxSearchPages:4},
 {name:'expanded_128_requests_8_pages',maxSearchRequests:128,maxSearchPages:8},
]){
 const events={http429:0,serverErrors:0,requestErrors:0,successes:0,accessWalls:0}
 const fetcher=createLinkedInStableFetcher({
  minIntervalMs:1100,maxAttempts:1,totalBudgetMs:190000,requestTimeoutMs:13000,
  onEvent:e=>{
   if(e.type==='response_error'){events.requestErrors++;if(e.status===429)events.http429++;if(e.status>=500)events.serverErrors++}
   if(e.type==='success')events.successes++
   if(e.type==='network_error')events.requestErrors++
  }
 })
 const started=Date.now()
 try{
  const result=await searchLinkedInShadow({freshnessDays:10,unionSearchPlan:plan,
   fetcher,maxSearchRequests:trial.maxSearchRequests,maxSearchPages:trial.maxSearchPages})
  const buckets={'0-2':0,'3-5':0,'6-10':0,'over10':0,'unknown':0}
  const dates={}
  const ids=[]
  const ageById={}
  for(const candidate of result.candidates){
   const age=dayAge(candidate.publishedAt)
   if(age===null) buckets.unknown++
   else if(age<=2&&age>=0)buckets['0-2']++
   else if(age<=5&&age>=3)buckets['3-5']++
   else if(age<=10&&age>=6)buckets['6-10']++
   else buckets.over10++
   const day=candidate.publishedAt?dateKey(candidate.publishedAt):'unknown'
   dates[day]=(dates[day]||0)+1
   ids.push(candidate.jobId)
   ageById[candidate.jobId]=age
  }
  all[trial.name]={...trial,durationSeconds:Math.round((Date.now()-started)/1000),stats:result.stats,
   coverage:result.coverage,events,buckets,dates,ids,ageById}
  console.log('EXPERIMENT_RESULT',JSON.stringify({...all[trial.name],ids:undefined}))
 }catch(e){
  all[trial.name]={...trial,durationSeconds:Math.round((Date.now()-started)/1000),error:String(e.message||e),events}
  console.log('EXPERIMENT_ERROR',JSON.stringify(all[trial.name]))
 }
 if(events.http429>0 || events.accessWalls>0){
  console.log('STOP_ON_ACCESS_LIMIT',JSON.stringify(events))
  break
 }
}
const a=all.baseline_64_requests_4_pages,b=all.expanded_128_requests_8_pages
if(a?.ids&&b?.ids){
 const base=new Set(a.ids),extra=b.ids.filter(id=>!base.has(id))
 console.log('EXPERIMENT_COMPARISON',JSON.stringify({baseline:a.ids.length,expanded:b.ids.length,
  newUniqueIds:extra.length,newUniqueDates:b.dates,
  new6to10:extra.filter(id=>b.ageById[id]>=6&&b.ageById[id]<=10).length,
  baseCoverage:a.coverage.status,expandedCoverage:b.coverage.status}))
}
