import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const JOBNET = 'https://jobnet.dk/bff'

const roleAliases = [
  { test: /technical\s+project\s+manager/i, aliases: [/technical\s+project\s+manager/i,/technical\s+program(?:me)?\s+manager/i,/technology\s+project\s+manager/i,/engineering\s+project\s+manager/i,/implementation\s+project\s+manager/i,/technical\s+delivery\s+(?:manager|lead)/i] },
  { test: /delivery\s+manager/i, aliases: [/delivery\s+manager/i,/delivery\s+lead/i,/it\s+delivery\s+manager/i,/software\s+delivery\s+(?:manager|lead)/i,/execution\s+lead/i,/software\s+execution\s+lead/i,/implementation\s+(?:manager|lead)/i] },
  { test: /senior\s+project\s+manager/i, aliases: [/senior\s+(?:it\s+|technical\s+|software\s+|digital\s+)?project\s+manager/i,/senior\s+project\s+lead/i,/lead\s+project\s+manager/i] },
  { test: /project\s+manager/i, aliases: [/(?:it|technical|software|digital|technology)\s+project\s+manager/i,/project\s+manager/i,/project\s+lead/i,/implementation\s+manager/i] },
  { test: /program(?:me)?\s+manager/i, aliases: [/program(?:me)?\s+manager/i,/program(?:me)?\s+lead/i,/strategic\s+program(?:me)?\s+manager/i,/portfolio\s+program(?:me)?\s+manager/i] },
]

function clean(value='') { return String(value ?? '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim() }
function norm(value='') { return clean(value).toLowerCase().replace(/[–—]/g,'-') }
function parseRoles(value='') { return String(value||'').split(/[,;\n]/).map(clean).filter(Boolean).slice(0,12) }
function escapeRx(value='') { return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') }
function daysOld(date) { const t = new Date(date).getTime(); return Number.isFinite(t) ? Math.max(0,(Date.now()-t)/DAY) : 999 }
function freshEnough(date, days) { return daysOld(date) <= days + 0.25 }
function uniq(arr){ return [...new Set(arr.filter(Boolean))] }


function expandSearchQueries(roles=[]){
  const out=[...roles]
  const joined=roles.join(' | ')
  if(/project manager/i.test(joined)) out.push('IT Project Manager','Software Project Manager','Project Lead')
  if(/delivery manager/i.test(joined)) out.push('Delivery Lead','IT Delivery Manager','Software Execution Lead')
  if(/technical project manager/i.test(joined)) out.push('Technical Project Manager','Implementation Manager')
  if(/program(?:me)? manager/i.test(joined)) out.push('Program Manager','Programme Manager')
  return uniq(out.map(clean)).slice(0,10)
}

function patternsForRole(role){
  const known = roleAliases.find(x=>x.test.test(role))
  if(known) return known.aliases
  const words = norm(role).split(/\s+/).filter(w=>w.length>2 && !['senior','lead','manager'].includes(w))
  if(!words.length) return [new RegExp(escapeRx(role),'i')]
  return [new RegExp(words.map(escapeRx).join('.*'),'i')]
}

function roleFit(title, targetRoles){
  const t=clean(title)
  let best=0, matched=''
  for(const role of targetRoles){
    const exact = new RegExp(`\\b${escapeRx(role).replace(/\\ /g,'\\s+')}\\b`,'i')
    if(exact.test(t) && 100>best){best=100;matched=role;continue}
    const aliases=patternsForRole(role)
    if(aliases.some(rx=>rx.test(t)) && 90>best){best=90;matched=role;continue}
    const targetTokens=norm(role).split(/\s+/).filter(w=>w.length>3 && !['senior','manager'].includes(w))
    const titleTokens=new Set(norm(t).split(/\s+/))
    const overlap=targetTokens.filter(w=>titleTokens.has(w)).length
    if(targetTokens.length){ const s=Math.round(overlap/targetTokens.length*75); if(s>best){best=s;matched=role} }
  }
  return {score:best,matchedRole:matched}
}

function hasMandatoryDanish(text=''){
  const t=clean(text)
  return /(?:must|required|mandatory|fluent|professional|native|proficient)[^.!?]{0,35}\bdanish\b/i.test(t) || /\bdanish\b[^.!?]{0,35}(?:must|required|mandatory|fluent|professional|native|proficient)/i.test(t)
}

function exclusionReason(job, exclusions=''){
  const raw=String(exclusions||'')
  const text=`${job.title} ${job.company} ${job.jd}`
  const title=norm(job.title)
  if(/mandatory\s+danish/i.test(raw) && hasMandatoryDanish(text)) return 'Mandatory Danish'
  if(/coordinator\s+or\s+assistant|coordinator|assistant/i.test(raw) && /\b(coordinator|assistant)\b/i.test(title) && !/\bmanager\b/i.test(title)) return 'Coordinator / assistant role'
  if(/construction/i.test(raw) && /\bconstruction\b/i.test(text)) return 'Construction'
  if(/(?:industrial\s+hardware|manufacturing\s+r&d|manufacturing\s+R&D)/i.test(raw) && /(?:industrial\s+hardware|hardware\s+(?:r&d|development)|manufacturing\s+(?:r&d|research)|research\s+and\s+development)/i.test(text)) return 'Industrial hardware / manufacturing R&D'
  const generic=raw.split(';').map(clean).filter(x=>x.length>=5 && !/mandatory danish|coordinator|assistant|construction|industrial hardware|manufacturing/i.test(x))
  for(const phrase of generic){
    const tokens=norm(phrase).split(/[^a-z0-9+#]+/).filter(x=>x.length>3)
    if(tokens.length>=2 && tokens.every(x=>norm(text).includes(x))) return phrase
  }
  return ''
}

function remoteGeoAllowed(location, geography=[]){
  const loc=norm(location)
  if(geography.includes('Remote worldwide')) return true
  if(geography.includes('Remote EU/EMEA')){
    if(/\b(worldwide|anywhere|global)\b/.test(loc)) return true
    if(/\b(europe|european|emea|eu\b|denmark|nordic|scandinavia|cet|cest)\b/.test(loc)) return true
  }
  if(geography.some(x=>x.startsWith('Denmark')) && /\bdenmark|copenhagen|danmark\b/.test(loc)) return true
  return false
}

function localDenmarkAllowed(job, geography=[]){
  if(!geography.some(x=>x.startsWith('Denmark'))) return false
  if(job.country && !/danmark|denmark/i.test(job.country)) return false
  return true
}

function preferredLocationMatch(job, preferredLocations=''){
  const prefs=String(preferredLocations||'').split(/[,;\n]/).map(norm).filter(Boolean)
  const loc=norm(job.location)
  const hit=prefs.find(p=>loc.includes(p)||p.includes(loc))
  return hit||''
}

function salaryStatus(job, salaryFloor){
  const floor=Number(salaryFloor||0)
  if(!floor) return {status:'not-used',reason:''}
  if(job.salaryCurrency!=='DKK' || !Number.isFinite(job.salaryMaxMonthly)) return {status:'unknown',reason:'Salary not stated in comparable DKK/month'}
  if(job.salaryMaxMonthly < floor) return {status:'below',reason:`Salary ceiling below ${floor.toLocaleString('en-DK')} DKK/month`}
  if(Number.isFinite(job.salaryMinMonthly) && job.salaryMinMonthly>=floor) return {status:'pass',reason:'Salary range meets floor'}
  return {status:'possible',reason:'Salary range overlaps floor'}
}

function scoreJob(job, profile){
  const roles=parseRoles(profile.roles)
  const role=roleFit(job.title,roles)
  if(role.score<45) return {reject:'Role/title outside target scope'}
  const geoOk=job.remote?remoteGeoAllowed(job.location,profile.geography||[]):localDenmarkAllowed(job,profile.geography||[])
  if(!geoOk) return {reject:'Geography outside search profile'}
  const ex=exclusionReason(job,profile.exclusions)
  if(ex) return {reject:ex}
  const sal=salaryStatus(job,profile.salary)
  if(sal.status==='below') return {reject:sal.reason}
  const age=daysOld(job.postedAt)
  const freshness=Math.max(0,Math.round(15-(age/Math.max(1,Number(profile.freshnessDays||7)))*10))
  const preferred=job.remote?'':preferredLocationMatch(job,profile.preferredLocations)
  const geoScore=job.remote?20:(preferred?20:14)
  const salaryScore=sal.status==='pass'?10:sal.status==='possible'?7:sal.status==='unknown'?4:6
  const score=Math.max(0,Math.min(100,Math.round(role.score*.55+geoScore+freshness+salaryScore)))
  const reasons=[`${role.matchedRole||'Target role'} title match`,job.remote?`Remote location allowed: ${job.location}`:(preferred?`Preferred Denmark location: ${job.location}`:`Capital Region location: ${job.location}`),`Posted ${Math.floor(age)} day${Math.floor(age)===1?'':'s'} ago`]
  if(sal.reason) reasons.push(sal.reason)
  return {score,reasons,salaryStatus:sal.status,matchedRole:role.matchedRole}
}

async function fetchJson(url, options={}, revalidate=3600){
  const res=await fetch(url,{...options,next:{revalidate},signal:AbortSignal.timeout(9000)})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return res.json()
}

async function jobnetSearch(query){
  const qs=new URLSearchParams({resultsPerPage:'25',pageNumber:'1',orderType:'PublicationDate',searchString:query,regions:'HovedstadenOgBornholm',workHoursType:'FullTime',employmentDurationType:'Permanent'})
  const data=await fetchJson(`${JOBNET}/FindJob/Search?${qs}`,{headers:{'x-csrf':'1'}},900)
  return Array.isArray(data.jobAds)?data.jobAds:[]
}

async function jobnetDetail(id){
  const data=await fetchJson(`${JOBNET}/FindJob/JobAdDetails/${encodeURIComponent(id)}?incrementViews=false`,{headers:{'x-csrf':'1'}},1800)
  const body=clean(data.body||'')
  const addr=data.job?.address||{}
  const url=data.application?.url || `/api/open-job?source=jobnet&id=${encodeURIComponent(id)}`
  return {body,url,address:clean([addr.city,addr.postalCode].filter(Boolean).join(' ')),country:addr.countryName||'Danmark',deadline:data.application?.deadlineDate||data.unpublicationDateTime||null}
}

async function getJobnet(profile){
  if(!(profile.geography||[]).some(x=>x.startsWith('Denmark'))) return []
  const targetRoles=parseRoles(profile.roles)
  const queries=expandSearchQueries(targetRoles)
  const batches=await Promise.allSettled(queries.map(jobnetSearch))
  const raw=[]
  for(const b of batches) if(b.status==='fulfilled') raw.push(...b.value)
  const seen=new Set(); const base=[]
  for(const x of raw){
    if(seen.has(x.jobAdId)) continue; seen.add(x.jobAdId)
    if(!freshEnough(x.publicationDate,Number(profile.freshnessDays||7))) continue
    const rf=roleFit(x.title,targetRoles); if(rf.score<45) continue
    base.push({id:String(x.jobAdId),source:'jobnet',sourceLabel:'Jobnet',company:clean(x.hiringOrgName||'Employer'),title:clean(x.title),location:clean(x.postalDistrictName||x.municipality||'Denmark'),country:x.country||'Danmark',postedAt:x.publicationDate,deadline:x.applicationDeadline||null,remote:false,url:`/api/open-job?source=jobnet&id=${encodeURIComponent(x.jobAdId)}`,jd:'',salaryCurrency:null,salaryMinMonthly:null,salaryMaxMonthly:null})
  }
  base.sort((a,b)=>roleFit(b.title,targetRoles).score-roleFit(a.title,targetRoles).score || new Date(b.postedAt)-new Date(a.postedAt))
  const top=base.slice(0,18)
  const details=await Promise.allSettled(top.map(j=>jobnetDetail(j.id)))
  return top.map((j,i)=>details[i]?.status==='fulfilled'?{...j,jd:details[i].value.body||j.jd,url:details[i].value.url||j.url,location:details[i].value.address||j.location,country:details[i].value.country||j.country,deadline:details[i].value.deadline||j.deadline}:j)
}

function jobicyGeo(profile){
  const geo=profile.geography||[]
  if(geo.includes('Remote worldwide')) return ''
  if(geo.includes('Remote EU/EMEA')) return 'emea'
  if(geo.some(x=>x.startsWith('Denmark'))) return 'denmark'
  return 'emea'
}
async function getJobicy(profile){
  if(!(profile.geography||[]).some(x=>x.startsWith('Remote')) && !(profile.geography||[]).some(x=>x.startsWith('Denmark'))) return []
  const geo=jobicyGeo(profile)
  const qs=new URLSearchParams({count:'100'}); if(geo) qs.set('geo',geo)
  const data=await fetchJson(`https://jobicy.com/api/v2/remote-jobs?${qs}`,{},3600)
  const rows=Array.isArray(data.jobs)?data.jobs:[]
  return rows.map(x=>{
    let min=null,max=null
    const currency=x.salaryCurrency||null; const period=norm(x.salaryPeriod||'')
    if(currency==='DKK'){
      const factor=/year|annual/.test(period)?1/12:/hour/.test(period)?160:1
      if(Number.isFinite(Number(x.salaryMin))) min=Number(x.salaryMin)*factor
      if(Number.isFinite(Number(x.salaryMax))) max=Number(x.salaryMax)*factor
    }
    return {id:String(x.id),source:'jobicy',sourceLabel:'Jobicy',company:clean(x.companyName||'Employer'),title:clean(x.jobTitle),location:clean(x.jobGeo||'Remote'),country:'',postedAt:x.pubDate,deadline:null,remote:true,url:x.url,jd:clean(x.jobDescription||x.jobExcerpt||''),jobType:Array.isArray(x.jobType)?x.jobType.join(', '):clean(x.jobType||''),salaryCurrency:currency,salaryMinMonthly:min,salaryMaxMonthly:max}
  })
}

function parseRemotiveSalary(value=''){
  const text=clean(value); const nums=(text.match(/[\d,.]+/g)||[]).map(x=>Number(x.replace(/,/g,''))).filter(Number.isFinite)
  const currency=/DKK/i.test(text)?'DKK':/€|EUR/i.test(text)?'EUR':/£|GBP/i.test(text)?'GBP':/\$|USD/i.test(text)?'USD':null
  let min=nums[0]??null,max=nums[1]??nums[0]??null
  if(currency==='DKK' && /year|annual|per annum/i.test(text)){min=min/12;max=max/12}
  return {currency,min:currency==='DKK'?min:null,max:currency==='DKK'?max:null}
}
async function getRemotive(profile){
  if(!(profile.geography||[]).some(x=>x.startsWith('Remote'))) return []
  const data=await fetchJson('https://remotive.com/api/remote-jobs?limit=100',{},21600)
  const rows=Array.isArray(data.jobs)?data.jobs:[]
  return rows.map(x=>{const s=parseRemotiveSalary(x.salary);return {id:String(x.id),source:'remotive',sourceLabel:'Remotive',company:clean(x.company_name||'Employer'),title:clean(x.title),location:clean(x.candidate_required_location||'Remote'),country:'',postedAt:x.publication_date,deadline:null,remote:true,url:x.url,jd:clean(x.description||''),jobType:clean(x.job_type||''),salaryCurrency:s.currency,salaryMinMonthly:s.min,salaryMaxMonthly:s.max}})
}

function dedupe(jobs){
  const map=new Map()
  for(const j of jobs){
    const key=`${norm(j.company).replace(/\W/g,'')}|${norm(j.title).replace(/\W/g,'')}`
    const prev=map.get(key)
    if(!prev || new Date(j.postedAt)>new Date(prev.postedAt) || (j.jd?.length||0)>(prev.jd?.length||0)) map.set(key,j)
  }
  return [...map.values()]
}

export async function POST(request){
  try{
    const body=await request.json()
    const profile={roles:clean(body?.roles),geography:Array.isArray(body?.geography)?body.geography:[],preferredLocations:clean(body?.preferredLocations),salary:body?.salary||'',exclusions:clean(body?.exclusions),freshnessDays:Math.max(1,Math.min(30,Number(body?.freshnessDays||7)))}
    if(!parseRoles(profile.roles).length) return NextResponse.json({error:'Add at least one target role to the Search Profile.'},{status:400})
    if(!profile.geography.length) return NextResponse.json({error:'Select at least one valid geography.'},{status:400})

    const sources=await Promise.allSettled([getJobnet(profile),getJobicy(profile),getRemotive(profile)])
    const warnings=[]; let all=[]
    const names=['Jobnet','Jobicy','Remotive']
    sources.forEach((s,i)=>{if(s.status==='fulfilled') all.push(...s.value); else warnings.push(`${names[i]} unavailable: ${s.reason?.message||'request failed'}`)})
    const rawCount=all.length
    all=dedupe(all)
    const rejected={role:0,geography:0,exclusion:0,salary:0,freshness:0}
    const kept=[]
    for(const job of all){
      if(!freshEnough(job.postedAt,profile.freshnessDays)){rejected.freshness++;continue}
      const result=scoreJob(job,profile)
      if(result.reject){
        if(/Role\/title/.test(result.reject)) rejected.role++
        else if(/Geography/.test(result.reject)) rejected.geography++
        else if(/Salary/.test(result.reject)) rejected.salary++
        else rejected.exclusion++
        continue
      }
      kept.push({...job,role:job.title,searchScore:result.score,reasons:result.reasons,salaryStatus:result.salaryStatus,matchedRole:result.matchedRole})
    }
    kept.sort((a,b)=>b.searchScore-a.searchScore || new Date(b.postedAt)-new Date(a.postedAt))
    return NextResponse.json({jobs:kept.slice(0,30),meta:{rawCount,dedupedCount:all.length,matchedCount:kept.length,rejected,warnings,freshnessDays:profile.freshnessDays,sources:names.filter((_,i)=>sources[i].status==='fulfilled'),fetchedAt:new Date().toISOString()}})
  }catch(error){
    console.error('search-jobs error',error)
    return NextResponse.json({error:'Live job search failed. Please retry.',detail:process.env.NODE_ENV==='development'?String(error?.message||error):undefined},{status:500})
  }
}
