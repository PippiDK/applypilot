import { NextResponse } from 'next/server'
import {
  NAERUM, clean, haversineKm, professionMatches, jdHardRejected,
} from '../../lib/company-search.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOBNET='https://jobnet.dk/bff'
const APICVR='https://apicvr.dk/api/v1'
const DAWA='https://api.dataforsyningen.dk'
const MAX_SEARCH_RESULTS=45
const MAX_FULL_JDS=24

// Agreed profession family. Internal only; user chooses only radius.
const SEARCH_TERMS=[
  'Senior Project Manager',
  'IT Project Manager',
  'Technical Project Manager',
  'Delivery Manager',
  'IT Delivery Manager',
  'Implementation Manager',
  'Transformation Project Manager',
  'Software Delivery Lead',
  'Platform Delivery Lead',
]

const TARGET_INDUSTRY=[
  /software|computerprogrammering|informationsteknolog|it-konsulent|it konsulent|saas|cloud|data|cyber/i,
  /bank|finans|betaling|payment|fintech|forsikring|insurance/i,
  /telekommunikation|telecom|kommunikationsteknolog|satellite/i,
  /energi|elektricitet|gasforsyning|forsyning|utility|utilities/i,
  /logistik|transport|lufttransport|luftfart|maritim|søtransport|skibsfart/i,
  /medicinsk|medtech|healthtech|sundhedsteknolog/i,
  /farmaceut|lægemiddel|pharma/i,
  /technology consulting|it consulting|rådgivning.*informationsteknolog|informationsteknolog.*rådgivning/i,
]

const COMPANY_EXCLUSIONS=[
  /forskning.*bioteknolog|bioteknolog.*forskning|research.*biotech|drug discovery/i,
  /arkitekt|architecture/i,
  /byggeri|bygge-? og anlæg|anlægsvirksomhed|civil engineering|construction|ejendomsudvikling|property development/i,
  /rekruttering|vikarbureau|recruitment|staffing agency/i,
  /reklamebureau|marketingbureau|creative agency|advertising agency/i,
]

const FIT_SIGNALS=[
  {label:'end-to-end delivery',jd:/end[- ]to[- ]end|full lifecycle|delivery lifecycle/i,cv:/end[- ]to[- ]end|full lifecycle|SIT|SAT|RFS|go-live|transition to operations/i},
  {label:'release / go-live',jd:/release readiness|go-live|production release|release management/i,cv:/release readiness|go-live|RFS|production|release/i},
  {label:'risk & dependencies',jd:/\brisk\b|dependenc|RAID/i,cv:/\brisk\b|dependenc|RAID/i},
  {label:'senior stakeholders',jd:/executive stakeholder|senior stakeholder|steering committee|stakeholder management/i,cv:/executive|senior stakeholder|steering|stakeholder/i},
  {label:'Agile / hybrid delivery',jd:/\bAgile\b|hybrid delivery|\bScrum\b|\bSAFe\b/i,cv:/\bAgile\b|\bHybrid\b|\bScrum\b|\bSAFe\b/i},
  {label:'Azure / cloud',jd:/\bAzure\b|\bcloud\b/i,cv:/\bAzure\b|\bcloud\b/i},
  {label:'data / SQL / BI',jd:/\bSQL\b|data platform|Power BI|\bBI\b|data warehouse|DWH/i,cv:/\bSQL\b|Power BI|\bBI\b|DWH|data warehouse/i},
  {label:'regulatory / compliance',jd:/regulated|regulatory|compliance|AML/i,cv:/regulated|regulatory|compliance|AML/i},
  {label:'integration',jd:/integration|interfaces?|\bAPI\b/i,cv:/integration|interfaces?|\bAPI\b/i},
  {label:'delivery governance',jd:/programme governance|program governance|delivery governance|PMO|governance/i,cv:/governance|roadmap|backlog governance|PMO/i},
  {label:'budget / financial oversight',jd:/\bbudget\b|financial oversight|cost management/i,cv:/\bbudget\b|financial/i},
  {label:'distributed teams',jd:/distributed|international teams|global teams|cross[- ]functional teams/i,cv:/distributed|international teams|Denmark.*India|India.*Poland|DK.*IN|cross[- ]functional/i},
  {label:'software / engineering delivery',jd:/software development|engineering teams|technical delivery|platform delivery|IT development/i,cv:/software|engineering|technical|platform|IT delivery/i},
]

function norm(v=''){return clean(v).toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ')}
function uniqBy(arr,keyFn){const seen=new Set();return arr.filter(x=>{const k=keyFn(x);if(!k||seen.has(k))return false;seen.add(k);return true})}
function chunk(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out}

async function fetchJson(url,options={},timeout=10000){
  const res=await fetch(url,{...options,headers:{'user-agent':'ApplyPilot/0.7.2 (+public-job-search)',...(options.headers||{})},signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return res.json()
}
async function fetchHtml(url,timeout=9000){
  const res=await fetch(url,{headers:{'user-agent':'ApplyPilot/0.7.2 (+public-job-search)','accept':'text/html,application/xhtml+xml'},redirect:'follow',signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  const type=res.headers.get('content-type')||''
  if(!/text\/html|application\/xhtml/i.test(type)) throw new Error('Not HTML')
  return {html:await res.text(),url:res.url}
}

function htmlToText(html=''){
  return clean(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' '))
}
function htmlTitle(html=''){
  const h1=String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if(h1&&clean(h1[1])) return clean(h1[1])
  const t=String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return t?clean(t[1]).replace(/\s+[|–—-]\s+[^|–—-]+$/,'').trim():''
}
function fullDescription(html=''){
  const text=htmlToText(html)
  return text.length>=500?text.slice(0,35000):''
}

async function jobnetSearch(term){
  const qs=new URLSearchParams({resultsPerPage:'50',pageNumber:'1',orderType:'PublicationDate',searchString:term,regions:'HovedstadenOgBornholm',workHoursType:'FullTime',employmentDurationType:'Permanent'})
  const data=await fetchJson(`${JOBNET}/FindJob/Search?${qs}`,{headers:{'x-csrf':'1'}},9000)
  return Array.isArray(data?.jobAds)?data.jobAds:[]
}

async function jobnetDetail(id){
  const data=await fetchJson(`${JOBNET}/FindJob/JobAdDetails/${encodeURIComponent(id)}?incrementViews=false`,{headers:{'x-csrf':'1'}},9000)
  const addr=data?.job?.address||{}
  return {
    jd:clean(data?.body||''),
    url:clean(data?.application?.url||''),
    postalCode:clean(addr?.postalCode||''),
    city:clean(addr?.city||''),
  }
}

async function loadJobnetCandidates(){
  const batches=await Promise.allSettled(SEARCH_TERMS.map(jobnetSearch))
  const raw=[]
  for(const b of batches) if(b.status==='fulfilled') raw.push(...b.value)
  const rows=[]
  for(const x of raw){
    const title=clean(x?.title||'')
    if(!professionMatches(title)) continue
    rows.push({
      id:String(x?.jobAdId||''),title,company:clean(x?.hiringOrgName||''),
      city:clean(x?.postalDistrictName||x?.municipality||''),postalCode:clean(x?.postalCode||''),
      externalUrl:clean(x?.jobAdUrl||''),isExternal:!!x?.isExternal,
      postedAt:x?.publicationDate||null,
    })
  }
  return uniqBy(rows,x=>x.id).slice(0,MAX_SEARCH_RESULTS)
}

async function postalCenter(postalCode,city){
  let rows=[]
  try{
    if(/^\d{4}$/.test(postalCode)) rows=await fetchJson(`${DAWA}/postnumre?nr=${encodeURIComponent(postalCode)}`,{},6000)
    if(!rows?.length&&city) rows=await fetchJson(`${DAWA}/postnumre?navn=${encodeURIComponent(city)}`,{},6000)
  }catch{return null}
  if(!Array.isArray(rows)||!rows.length) return null
  const wanted=norm(city)
  const row=rows.find(r=>wanted&&norm(r?.navn)===wanted)||rows[0]
  const p=row?.visueltcenter
  if(!Array.isArray(p)||p.length<2) return null
  const lon=Number(p[0]),lat=Number(p[1])
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return null
  return {lat,lon,postalCode:String(row?.nr||postalCode||''),city:clean(row?.navn||city)}
}

async function cvrCompany(companyName){
  if(!companyName) return null
  try{
    const url=`${APICVR}/search/company/${encodeURIComponent(companyName)}?limit=5`
    const rows=await fetchJson(url,{},8000)
    if(!Array.isArray(rows)||!rows.length) return null
    const target=norm(companyName).replace(/\b(a\/s|aps|a s)\b/g,'').trim()
    const scored=rows.map(r=>{
      const n=norm(r?.name||'').replace(/\b(a\/s|aps|a s)\b/g,'').trim()
      let score=n===target?100:(n.includes(target)||target.includes(n)?80:0)
      const tokens=target.split(/\W+/).filter(x=>x.length>2)
      if(!score&&tokens.length) score=Math.round(tokens.filter(t=>n.includes(t)).length/tokens.length*60)
      return {r,score}
    }).sort((a,b)=>b.score-a.score)
    return scored[0]?.score>=40?scored[0].r:null
  }catch{return null}
}

function employeeNumber(v){
  if(Number.isFinite(Number(v))) return Number(v)
  const nums=String(v||'').match(/\d[\d.]*/g)||[]
  if(!nums.length) return null
  return Math.max(...nums.map(x=>Number(x.replace(/\./g,''))).filter(Number.isFinite))
}

function companyPass(record,jd=''){
  const industry=clean(record?.industrydesc||record?.industrytext||'')
  const combined=`${industry} ${clean(jd)}`
  if(COMPANY_EXCLUSIONS.some(rx=>rx.test(combined))) return {pass:false,reason:'Company type excluded'}
  const employees=employeeNumber(record?.employees)
  const targetIndustry=TARGET_INDUSTRY.some(rx=>rx.test(industry))
  // Agreed employer profile: large enterprise is acceptable; 20-99 only in target industries.
  if(Number.isFinite(employees)){
    if(employees>=100) return {pass:true,employees,industry}
    if(employees>=20&&targetIndustry) return {pass:true,employees,industry}
    return {pass:false,reason:'Company does not meet employer profile'}
  }
  // Public CVR mirrors occasionally omit employee count. Fail closed unless industry is clearly one of the agreed target types.
  if(targetIndustry) return {pass:true,employees:null,industry}
  return {pass:false,reason:'Company type/size could not be confirmed'}
}

async function getFullJob(candidate){
  let detail=null
  if(!candidate.isExternal||!candidate.externalUrl){
    try{detail=await jobnetDetail(candidate.id)}catch{}
  }
  let jd=clean(detail?.jd||'')
  let url=clean(candidate.externalUrl||detail?.url||'')
  let city=clean(detail?.city||candidate.city)
  let postalCode=clean(detail?.postalCode||candidate.postalCode)

  // External Jobnet listings already point to the employer/ATS. Read that page directly.
  if(url&&(!jd||jd.length<500)){
    try{
      const page=await fetchHtml(url,9000)
      const pageText=fullDescription(page.html)
      if(pageText) jd=pageText
      url=page.url||url
      const title=htmlTitle(page.html)
      if(title&&professionMatches(title)) candidate={...candidate,title}
    }catch{}
  }
  if(!jd||jd.length<500||!url) return null
  return {...candidate,jd,url,city,postalCode}
}

function evaluateFitLocal(jd,cvText,title){
  const job=clean(jd),cv=clean(cvText)
  const hard=jdHardRejected(job)
  if(hard) return {fit:false,score:0,reason:hard,gaps:[hard]}
  if(!professionMatches(title)) return {fit:false,score:0,reason:'Profession outside target family',gaps:[]}

  // The vacancy must actually be an IT/software/platform/digital delivery role, not merely share a PM title.
  const itScope=/\b(?:IT|software|digital|technology|technical|platform|cloud|data|systems?|applications?|engineering)\b/i.test(job)
  const deliveryScope=/\b(?:project|delivery|implementation|transformation|programme|program|release|go-live|roadmap|stakeholder)\b/i.test(job)
  if(!itScope||!deliveryScope) return {fit:false,score:0,reason:'Full JD is not an IT/software/digital delivery role',gaps:[]}

  const detected=FIT_SIGNALS.filter(s=>s.jd.test(job))
  const matched=detected.filter(s=>s.cv.test(cv))
  const gaps=detected.filter(s=>!s.cv.test(cv)).map(s=>s.label)
  const coverage=detected.length?matched.length/detected.length:0

  // Conservative full-JD gate. A matching title alone can never pass.
  if(detected.length>=3&&coverage<0.40) return {fit:false,score:Math.round(35+coverage*40),reason:'Too many material JD requirements are not supported by the Master CV',gaps:gaps.slice(0,4)}
  if(detected.length<3){
    const anchors=['project','delivery','software','platform','stakeholder','risk','agile','azure','sql','integration','governance','release','compliance']
    const jobAnchors=anchors.filter(a=>new RegExp(`\\b${a}`).test(norm(job)))
    const overlap=jobAnchors.filter(a=>new RegExp(`\\b${a}`).test(norm(cv)))
    if(jobAnchors.length>=3&&overlap.length/jobAnchors.length<0.4) return {fit:false,score:50,reason:'Full JD has insufficient evidence match in the Master CV',gaps:[]}
  }

  const score=Math.max(60,Math.min(96,Math.round(62+(detected.length?coverage:0.5)*30)))
  const reason=matched.length
    ? `Full JD matches verified CV evidence in ${matched.slice(0,4).map(x=>x.label).join(', ')}.`
    : 'Full JD is within the target IT delivery profession and no material contradiction was found in the Master CV.'
  return {fit:true,score,reason,gaps:gaps.slice(0,4)}
}

export async function POST(request){
  try{
    const body=await request.json()
    const radiusKm=Number(body?.radiusKm)
    const cvText=clean(body?.cvText||'')
    if(![10,20,30,40,50].includes(radiusKm)) return NextResponse.json({error:'Choose a search radius: 10, 20, 30, 40 or 50 km.'},{status:400})
    if(cvText.length<100) return NextResponse.json({error:'Master CV must be analysed before search.'},{status:400})

    // No Datafordeler/MitID/app API key is required for this search path.
    // 1) Public Jobnet index -> active jobs in the agreed profession family.
    const candidates=await loadJobnetCandidates()

    // 2) Exact radius from Nærum (using public DAWA postal geography).
    const geoReady=[]
    for(const group of chunk(candidates,8)){
      const settled=await Promise.allSettled(group.map(async c=>{
        const center=await postalCenter(c.postalCode,c.city)
        if(!center) return null
        const distanceKm=haversineKm(NAERUM.lat,NAERUM.lon,center.lat,center.lon)
        return distanceKm<=radiusKm?{...c,...center,distanceKm}:null
      }))
      for(const r of settled) if(r.status==='fulfilled'&&r.value) geoReady.push(r.value)
    }

    // 3) Full JD is mandatory; external Jobnet links are read directly from employer/ATS pages.
    const fullJobs=[]
    for(const group of chunk(geoReady.slice(0,MAX_FULL_JDS),6)){
      const settled=await Promise.allSettled(group.map(getFullJob))
      for(const r of settled) if(r.status==='fulfilled'&&r.value) fullJobs.push(r.value)
    }

    // 4) Public CVR enrichment -> internal company type / size hard gate.
    const matches=[]
    const companyCache=new Map()
    for(const item of fullJobs){
      let record=companyCache.get(norm(item.company))
      if(record===undefined){record=await cvrCompany(item.company);companyCache.set(norm(item.company),record||null)}
      if(!record) continue
      const employer=companyPass(record,item.jd)
      if(!employer.pass) continue

      // 5) Mandatory final gate: read FULL JD + FULL Master CV and show only genuine fits.
      const fit=evaluateFitLocal(item.jd,cvText,item.title)
      if(!fit.fit) continue
      matches.push({
        id:`${item.id}:${item.url}`,
        source:'company',sourceLabel:'Company vacancy',
        role:item.title,company:item.company,
        location:clean([item.postalCode,item.city].filter(Boolean).join(' ')),
        distanceKm:Number(item.distanceKm.toFixed(1)),url:item.url,jd:item.jd,
        fitScore:fit.score,fitReason:fit.reason,gaps:fit.gaps,
        cvr:String(record?.vat||record?.cvr_number||''),industry:employer.industry||'',
        companyWebsite:clean(record?.website||''),postedAt:item.postedAt,
      })
    }

    const deduped=uniqBy(matches,x=>`${norm(x.company)}|${norm(x.role)}`)
      .sort((a,b)=>b.fitScore-a.fitScore||a.distanceKm-b.distanceKm)

    return NextResponse.json({jobs:deduped,meta:{
      matchedCount:deduped.length,radiusKm,
      professionCandidates:candidates.length,
      insideRadius:geoReady.length,
      fullJdsChecked:fullJobs.length,
      companiesChecked:companyCache.size,
      source:'Public Jobnet + public CVR + company/ATS pages',
      noUserCredentials:true,
    }})
  }catch(error){
    console.error('company-search error',error)
    return NextResponse.json({error:'Company search is temporarily unavailable.',detail:process.env.NODE_ENV==='development'?String(error?.message||error):undefined},{status:500})
  }
}
