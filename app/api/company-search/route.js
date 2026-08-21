import { NextResponse } from 'next/server'
import AdmZip from 'adm-zip'
import { generateText } from 'ai'
import {
  NAERUM, clean, haversineKm, municipalityCodes, companyProfileDecision,
  corporateDomainFromEmails, careerLinks, jobLinks, htmlTitle,
  fullJobDescription, professionMatches, jdHardRejected,
} from '../../lib/company-search.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FILE_API='https://api.datafordeler.dk/FileDownloads/v2.0'
const CVR_GRAPHQL='https://graphql.datafordeler.dk/flexibleCurrent/v4'
const DAWA='https://api.dataforsyningen.dk'
const MAX_COMPANIES_TO_CRAWL=80
const MAX_JOB_PAGES=24

function pick(obj,...keys){
  for(const key of keys){
    if(obj && obj[key]!==undefined && obj[key]!==null) return obj[key]
    const found=obj && Object.keys(obj).find(k=>k.toLowerCase()===String(key).toLowerCase())
    if(found) return obj[found]
  }
  return undefined
}
function asArray(v){return Array.isArray(v)?v:v?[v]:[]}
function chunk(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out}
function uniqBy(arr,keyFn){const seen=new Set();return arr.filter(x=>{const k=keyFn(x);if(!k||seen.has(k))return false;seen.add(k);return true})}
function addressId(value=''){
  const s=String(value||'').trim()
  const m=s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m?m[0]:''
}
function addressText(row){
  const street=pick(row,'CVRAdresse_vejnavn','vejnavn')
  const no=pick(row,'CVRAdresse_husnummerFra','husnummerFra')
  const zip=pick(row,'CVRAdresse_postnummer','postnummer')
  const city=pick(row,'CVRAdresse_postdistrikt','postdistrikt')
  return clean([street,no,zip,city].filter(Boolean).join(' '))
}

async function fetchJson(url,options={},timeout=12000){
  const res=await fetch(url,{...options,signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return res.json()
}
async function fetchBuffer(url,timeout=15000){
  const res=await fetch(url,{signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
async function fetchHtml(url,timeout=7000){
  const res=await fetch(url,{headers:{'user-agent':'ApplyPilot/0.7 (+job-search; public-career-pages-only)','accept':'text/html,application/xhtml+xml'},redirect:'follow',signal:AbortSignal.timeout(timeout),cache:'no-store'})
  if(!res.ok) throw new Error(`${new URL(url).hostname}: ${res.status}`)
  const type=res.headers.get('content-type')||''
  if(!/text\/html|application\/xhtml/i.test(type)) throw new Error('Not HTML')
  return {html:await res.text(),url:res.url}
}

async function availableFiles(entity,apiKey){
  let page=1,total=1,all=[]
  while(page<=total && page<=20){
    const qs=new URLSearchParams({Register:'CVR',Version:'2',Entity:entity,PageNumber:String(page),apiKey})
    const data=await fetchJson(`${FILE_API}/GetAvailableFileDownloads?${qs}`)
    const files=pick(data,'AvailableFileDownloads','availableFileDownloads')||[]
    all.push(...files)
    const meta=pick(data,'PaginationMetadata','paginationMetadata')||{}
    total=Number(pick(meta,'TotalPages','totalPages')||1)
    page++
  }
  return all
}

function selectMunicipalFiles(files,codes){
  const wanted=new Set(codes)
  const candidates=files.filter(f=>{
    const municipality=String(pick(f,'MunicipalityCode','municipalityCode')||'').padStart(4,'0')
    const format=String(pick(f,'ContainedFileFormat','containedFileFormat')||'').toLowerCase()
    const type=String(pick(f,'TypeOfDownload','typeOfDownload')||'').toLowerCase()
    return wanted.has(municipality) && format==='json' && type.includes('total')
  })
  const byMunicipality=new Map()
  for(const file of candidates){
    const municipality=String(pick(file,'MunicipalityCode','municipalityCode')||'').padStart(4,'0')
    const generation=Number(pick(file,'GenerationNumber','generationNumber')||0)
    const prior=byMunicipality.get(municipality)
    if(!prior || generation>prior.generation) byMunicipality.set(municipality,{file,generation})
  }
  return [...byMunicipality.values()].map(x=>x.file)
}

function parseJsonPayload(text=''){
  const raw=String(text).trim()
  if(!raw) return []
  try{
    const parsed=JSON.parse(raw)
    if(Array.isArray(parsed)) return parsed
    if(parsed && typeof parsed==='object'){
      const arr=Object.values(parsed).find(Array.isArray)
      if(arr) return arr
      return [parsed]
    }
  }catch{}
  const rows=[]
  for(const line of raw.split(/\r?\n/)){
    const t=line.trim();if(!t)continue
    try{rows.push(JSON.parse(t))}catch{}
  }
  return rows
}

async function downloadRows(file,apiKey){
  const filename=pick(file,'Filename','FileName','filename','fileName')
  if(!filename) return []
  const qs=new URLSearchParams({Filename:filename,apiKey})
  const zipBuffer=await fetchBuffer(`${FILE_API}/GetFile?${qs}`)
  const zip=new AdmZip(zipBuffer)
  const entry=zip.getEntries().find(e=>!e.isDirectory && /\.json$/i.test(e.entryName)) || zip.getEntries().find(e=>!e.isDirectory)
  if(!entry) return []
  return parseJsonPayload(entry.getData().toString('utf8'))
}

async function loadAddressRows(radiusKm,apiKey){
  const codes=municipalityCodes(radiusKm)
  const files=selectMunicipalFiles(await availableFiles('Adressering',apiKey),codes)
  if(!files.length) throw new Error('CVR municipality address files were not found.')
  const batches=[]
  for(const group of chunk(files,4)){
    const settled=await Promise.allSettled(group.map(f=>downloadRows(f,apiKey)))
    for(const result of settled) if(result.status==='fulfilled') batches.push(...result.value)
  }
  return batches.filter(row=>{
    const use=clean(pick(row,'AdresseringAnvendelse','adresseringAnvendelse')||'')
    const country=clean(pick(row,'CVRAdresse_landekode','landekode')||'DK')
    return (!use || /beliggenhedsadresse/i.test(use)) && (!country || /^DK$/i.test(country))
  })
}

async function geocodeDarIds(rows){
  const idToRow=new Map()
  for(const row of rows){
    const id=addressId(pick(row,'Adresse','adresse'))
    if(id && !idToRow.has(id)) idToRow.set(id,row)
  }
  const coords=new Map()
  for(const ids of chunk([...idToRow.keys()],25)){
    try{
      const qs=new URLSearchParams({id:ids.join('|'),format:'geojson',geometri:'adgangspunkt'})
      const data=await fetchJson(`${DAWA}/adresser?${qs}`,{},10000)
      for(const feature of asArray(data?.features)){
        const id=pick(feature?.properties||{},'id','adresseid')
        const pair=feature?.geometry?.coordinates
        if(id && Array.isArray(pair) && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1]))) coords.set(String(id),{lon:Number(pair[0]),lat:Number(pair[1])})
      }
    }catch{}
  }
  return rows.map(row=>{
    const id=addressId(pick(row,'Adresse','adresse'))
    const point=coords.get(id)
    if(!point) return null
    return {row,addressId:id,address:addressText(row),...point,distanceKm:haversineKm(NAERUM.lat,NAERUM.lon,point.lat,point.lon)}
  }).filter(Boolean)
}

async function queryCvrCompanies(entityIds,apiKey){
  const out=[]
  const now=new Date().toISOString()
  for(const ids of chunk(entityIds,35)){
    const quoted=ids.map(id=>JSON.stringify(id)).join(',')
    const query=`{
      CVR_CVREnhed(first:${ids.length},virkningstid:${JSON.stringify(now)},where:{id:{in:[${quoted}]}}){
        nodes{
          id forretningsnoegle forretningsnoegletype enhedsType
          id_CVR_Navn_CVREnhedsId_ref(first:5){nodes{vaerdi sekvens}}
          id_CVR_Branche_CVREnhedsId_ref(first:10){nodes{vaerdi vaerdiTekst sekvens}}
          id_CVR_Beskaeftigelse_CVREnhedsId_ref(first:10){nodes{beskaeftigelsestalstype antal datoFra datoTil intervalFra intervalTil registreringsdato}}
          id_CVR_e_mailadresse_CVREnhedsId_ref(first:10){nodes{vaerdi}}
        }
      }
    }`
    const url=`${CVR_GRAPHQL}?apiKey=${encodeURIComponent(apiKey)}`
    const data=await fetchJson(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query})},15000)
    if(data?.errors?.length) throw new Error(`CVR GraphQL: ${data.errors[0]?.message||'query failed'}`)
    out.push(...(data?.data?.CVR_CVREnhed?.nodes||[]))
  }
  return out
}

function relationNodes(company,name){return company?.[name]?.nodes||[]}
function companyName(company){
  const names=relationNodes(company,'id_CVR_Navn_CVREnhedsId_ref')
  return clean(names.sort((a,b)=>Number(a?.sekvens||0)-Number(b?.sekvens||0))[0]?.vaerdi||'')
}

async function resolveWebsite(domain){
  if(!domain) return ''
  for(const url of [`https://${domain}/`,`https://www.${domain}/`]){
    try{const r=await fetchHtml(url,5000);return r.url}catch{}
  }
  return ''
}

async function discoverJobs(company){
  const home=await fetchHtml(company.website,7000)
  let careers=careerLinks(home.html,home.url)
  if(!careers.length){
    careers=[
      {url:new URL('/careers',home.url).toString(),text:'careers'},
      {url:new URL('/jobs',home.url).toString(),text:'jobs'},
      {url:new URL('/career',home.url).toString(),text:'career'},
      {url:new URL('/karriere',home.url).toString(),text:'karriere'},
    ]
  }
  const found=[]
  for(const c of careers.slice(0,5)){
    try{
      const page=await fetchHtml(c.url,7000)
      found.push(...jobLinks(page.html,page.url))
    }catch{}
  }
  return uniqBy(found,x=>x.url).slice(0,12)
}

function extractJson(text=''){
  const raw=String(text).trim()
  try{return JSON.parse(raw)}catch{}
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if(fenced){try{return JSON.parse(fenced[1])}catch{}}
  const a=raw.indexOf('{'),b=raw.lastIndexOf('}')
  if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1))}catch{}}
  throw new Error('AI returned invalid JSON')
}

async function evaluateFit({job,company,cvText}){
  const masterCv=clean(cvText)
  const prompt=`You are the final vacancy gate for ApplyPilot. Decide whether this vacancy is genuinely suitable for the candidate by reading the FULL job description and the supplied Master CV evidence.

COMPANY: ${company.name}
COMPANY INDUSTRY: ${company.branchText}
ROLE: ${job.title}
FULL JOB DESCRIPTION:
${job.jd}

FULL MASTER CV:
${masterCv}

Decision rules:
- Return fit=false when the job's core responsibilities, seniority, mandatory experience, technology/domain expectations, or delivery scope materially do not match the CV.
- Do not infer experience that is absent from the CV.
- The role must be an IT/software/platform/digital delivery/project role, not R&D, construction, architecture, laboratory research, hardware product R&D, coordinator or assistant work.
- A matching title alone is never enough.
- If information is ambiguous or a mandatory requirement is unsupported, be conservative.

Return ONLY JSON:
{"fit":true,"score":0,"reason":"one concise evidence-based explanation","gaps":["material gap if any"]}`
  const result=await generateText({model:process.env.AI_MODEL||'openai/gpt-5.5',prompt,temperature:0.1})
  const parsed=extractJson(result.text)
  return {fit:parsed?.fit===true,score:Math.max(0,Math.min(100,Number(parsed?.score)||0)),reason:clean(parsed?.reason||''),gaps:Array.isArray(parsed?.gaps)?parsed.gaps.map(clean).filter(Boolean).slice(0,4):[]}
}

export async function POST(request){
  try{
    const body=await request.json()
    const radiusKm=Number(body?.radiusKm)
    const cvText=clean(body?.cvText||'')
    if(![10,20,30,40,50].includes(radiusKm)) return NextResponse.json({error:'Choose a search radius: 10, 20, 30, 40 or 50 km.'},{status:400})
    if(cvText.length<100) return NextResponse.json({error:'Master CV must be analysed before search.'},{status:400})

    // One server-side Datafordeler credential belongs to ApplyPilot itself.
    // It is never accepted from the browser and is never returned to the user.
    const apiKey=String(process.env.DATAFORDELER_API_KEY||'').trim()
    if(!apiKey){
      console.error('company-search configuration error: Datafordeler credential is missing')
      return NextResponse.json({error:'Company search is temporarily unavailable.'},{status:503})
    }

    // 1) CVR companies whose registered business address is inside the chosen radius.
    const addressRows=await loadAddressRows(radiusKm,apiKey)
    const geo=await geocodeDarIds(addressRows)
    const inside=geo.filter(x=>x.distanceKm<=radiusKm)
    const byEntity=new Map()
    for(const x of inside){
      const entityId=String(pick(x.row,'CVREnhedsId','cvrEnhedsId')||'')
      if(entityId && !byEntity.has(entityId)) byEntity.set(entityId,x)
    }

    // 2) Apply the internal company-type / size profile. No user dropdowns.
    const cvrRows=await queryCvrCompanies([...byEntity.keys()],apiKey)
    const companies=[]
    for(const c of cvrRows){
      if(!/virksomhed/i.test(clean(c?.enhedsType||''))) continue
      const location=byEntity.get(String(c.id))
      if(!location) continue
      const branches=relationNodes(c,'id_CVR_Branche_CVREnhedsId_ref')
      const employment=relationNodes(c,'id_CVR_Beskaeftigelse_CVREnhedsId_ref')
      const profile=companyProfileDecision({branches,employment})
      if(!profile.pass) continue
      const name=companyName(c)
      if(!name) continue
      const emails=relationNodes(c,'id_CVR_e_mailadresse_CVREnhedsId_ref')
      const domain=corporateDomainFromEmails(emails)
      if(!domain) continue
      companies.push({id:String(c.id),cvr:String(c.forretningsnoegle||''),name,address:location.address,distanceKm:location.distanceKm,domain,branchText:profile.branchText,employees:profile.employees})
    }

    // 3) Official company website -> career page -> agreed profession family -> FULL JD.
    const websiteReady=[]
    for(const group of chunk(companies.slice(0,MAX_COMPANIES_TO_CRAWL),8)){
      const settled=await Promise.allSettled(group.map(async c=>({...c,website:await resolveWebsite(c.domain)})))
      for(const r of settled) if(r.status==='fulfilled'&&r.value.website) websiteReady.push(r.value)
    }

    const jobCandidates=[]
    for(const group of chunk(websiteReady,6)){
      const settled=await Promise.allSettled(group.map(async company=>({company,links:await discoverJobs(company)})))
      for(const r of settled){
        if(r.status!=='fulfilled') continue
        for(const link of r.value.links) jobCandidates.push({company:r.value.company,link})
      }
      if(jobCandidates.length>=MAX_JOB_PAGES) break
    }

    const fullJobs=[]
    for(const group of chunk(jobCandidates.slice(0,MAX_JOB_PAGES),6)){
      const settled=await Promise.allSettled(group.map(async item=>{
        const page=await fetchHtml(item.link.url,8000)
        const title=htmlTitle(page.html)||clean(item.link.text)
        if(!professionMatches(title)) return null
        const jd=fullJobDescription(page.html)
        if(!jd) return null
        if(jdHardRejected(jd)) return null
        return {company:item.company,title,jd,url:page.url}
      }))
      for(const r of settled) if(r.status==='fulfilled'&&r.value) fullJobs.push(r.value)
    }

    // 4) Mandatory final gate: full JD vs Master CV. Fail closed: only fit=true is shown.
    const matches=[]
    for(const item of fullJobs){
      try{
        const fit=await evaluateFit({job:item,company:item.company,cvText})
        if(!fit.fit) continue
        matches.push({
          id:`${item.company.cvr}:${item.url}`,
          source:'company',sourceLabel:'Company career site',
          role:item.title,company:item.company.name,location:item.company.address,
          distanceKm:Number(item.company.distanceKm.toFixed(1)),url:item.url,jd:item.jd,
          fitScore:fit.score,fitReason:fit.reason,gaps:fit.gaps,
          cvr:item.company.cvr,industry:item.company.branchText,
        })
      }catch(error){
        const message=String(error?.message||error)
        if(/credit card|customer_verification_required|gateway|403/i.test(message)) throw new Error('AI fit evaluation is not available yet. The search is stopped because full JD vs CV evaluation is mandatory.')
        throw error
      }
    }

    matches.sort((a,b)=>b.fitScore-a.fitScore || a.distanceKm-b.distanceKm)
    return NextResponse.json({jobs:matches,meta:{matchedCount:matches.length,radiusKm,companiesInRadius:byEntity.size,companiesAfterProfile:companies.length,careerSitesChecked:websiteReady.length,fullJdsChecked:fullJobs.length,source:'CVR + company career sites'}})
  }catch(error){
    console.error('company-search error',error)
    return NextResponse.json({error:String(error?.message||'Company search failed.')},{status:500})
  }
}
