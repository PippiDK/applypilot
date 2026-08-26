import { classifyRoleTitle } from './linkedin-role-gate.js'
const LINKEDIN_SEARCH = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const LINKEDIN_JOB_DETAIL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'
const LINKEDIN_JOB = 'https://www.linkedin.com/jobs/view/'

export const DISCOVERY_QUERIES = [
  'Senior IT Project Manager',
  'Technical Project Manager',
  'Senior Project Manager technology',
  'Delivery Manager software',
  'Delivery Lead technology',
  'Implementation Project Manager',
  'Transformation Project Manager IT',
  'Program Manager technology',
  'Software Execution Lead',
  'IT-projektleder',
]

const TITLE_SIGNALS = [
  'project manager','projektleder','project lead','delivery manager','delivery lead','execution lead',
  'implementation manager','implementation lead','integration project manager','transformation project manager',
  'transformation lead','program manager','programme manager','programleder','platform delivery','technology project',
  'digital project','business technology','portfolio delivery','it-projektleder','teknisk projektleder',
  'digital projektleder','implementeringsprojektleder','transformationsprojektleder'
]

const PREFERRED_LOCATIONS = ['nærum','hørsholm','lyngby','kongens lyngby','virum','holte','vedbæk','gentofte','hellerup','ballerup']
const FINTECH_TERMS = ['fintech','banking','bank','trading','post-trade','payments','regulatory reporting','aml','compliance systems','financial data','risk & compliance']


const RESPONSIBILITY_CATEGORIES = {
  end_to_end: [/\bend[- ]to[- ]end\b.{0,80}\b(deliver|delivery|project|programme|program|execution|ownership)\b/i, /\b(full lifecycle|full life cycle)\b/i, /\b(own|owns|owned|take|takes|taking)\b.{0,35}\b(full|end[- ]to[- ]end)?\s*(delivery|lifecycle|project|programme|program)\b/i, /\blead and deliver\b/i, /\blead delivery\b/i],
  scope_schedule: [/\b(scope|timeline|timelines|schedule|schedules|milestone|milestones)\b/i, /\b(on time|within scope|delivery plan|project plan|integrated plan)\b/i],
  risk_dependencies: [/\brisks?\b/i, /\bdependencies\b/i, /\braid\b/i, /\bissues?\b.{0,25}\bdependencies\b/i],
  budget_financial: [/\bbudget(s|ing)?\b/i, /\bfinancial (management|tracking|control|performance|forecast|forecasting)\b/i, /\bcapex\b|\bopex\b|\bcost control\b|\bforecasting\b/i],
  accountability_outcomes: [/\baccountab(le|ility)\b/i, /\bdelivery outcomes?\b/i, /\b(tangible|measurable|successful|business) outcomes?\b/i, /\bdeliver measurable business value\b/i, /\bresponsible for\b.{0,55}\b(delivery|execution|outcomes?)\b/i],
  cross_functional: [/\bcross[- ]functional\b/i, /\bacross (business|product|technology|engineering).{0,70}(teams|stakeholders|functions)\b/i, /\b(business and technology|product and engineering|architecture and engineering)\b/i],
  stakeholders: [/\bsenior stakeholders?\b/i, /\bexecutive (communication|reporting|stakeholders?|leadership|forums?)\b/i, /\bstakeholder (management|alignment|expectations|communication)\b/i, /\bsteerco\b|\bsteering committee\b/i],
  governance: [/\bgovernance\b/i, /\bdecision framework\b/i, /\bprogress reporting\b/i, /\bproject reporting\b/i],
  roadmap_planning: [/\broadmap(s)?\b/i, /\bstrategic planning\b/i, /\bplanning\b.{0,35}\b(execution|delivery|portfolio|project|program)\b/i, /\bprioritisation\b|\bprioritization\b/i],
  implementation_release: [/\bimplementation\b|\bmigration\b|\btransition\b/i, /\brelease readiness\b|\brelease\b|\buat\b|\bcutover\b|\bgo[- ]live\b|\bhypercare\b|\bhandover\b/i, /\bdeployment lifecycle\b|\bdeployment project\b/i],
  team_leadership: [/\b(lead|leading|manage|managing|coordinate|coordinating)\b.{0,55}\b(teams|project managers|engineering teams|agile teams)\b/i, /\blead without formal authority\b/i, /\bfunctional leadership\b/i],
}

const TECHNOLOGY_CATEGORIES = {
  it_software: [/\binformation technology\b/i, /\bit project\b/i, /\bgroup it\b/i, /\bcorporate it\b/i, /\bsoftware\b/i, /\btechnology\b/i],
  digital_transformation: [/\bdigital transformation\b/i, /\btechnology transformation\b/i, /\bit transformation\b/i, /\bdigital\b.{0,40}\b(project|delivery|initiative|transformation)\b/i],
  platform: [/\bplatform(s)?\b/i, /\benterprise applications?\b/i, /\bbusiness systems?\b/i, /\bapi(s)?\b/i],
  engineering: [/\bengineering teams?\b/i, /\bsoftware engineering\b/i, /\btechnical implementation\b/i, /\bdevelopment workflows?\b/i],
  infrastructure_cloud: [/\binfrastructure\b/i, /\bcloud\b/i, /\bdata centre\b|\bdata center\b/i, /\bcybersecurity\b|\bcyber security\b/i],
  data: [/\bdata platform(s)?\b/i, /\bdata transformation\b/i, /\bdata engineering\b/i, /\bdatabricks\b/i, /\bsnowflake\b/i, /\banalytics\b|\bbi\b/i],
  integration: [/\bsystems? integration\b/i, /\bintegration projects?\b/i, /\bintegrations?\b/i, /\bmigration\b.{0,35}\b(platform|system|technology|data)\b/i],
  automation_ai: [/\bautomation\b/i, /\bai strategy\b|\bai transformation\b|\bai-enabled\b/i, /\bengineering tooling\b/i],
  financial_technology: [/\bfintech\b/i, /\bbanking platform\b/i, /\btrading systems?\b/i, /\bpost[- ]trade\b/i, /\bpayments?\b/i, /\bfinancial data\b/i],
}

const EVIDENCE_CATEGORIES = {
  project_delivery: [/\bend[- ]to[- ]end\b/i, /\bproject delivery\b/i, /\bdelivery management\b/i, /\bfull lifecycle\b/i],
  platform: [/\bplatform(s)?\b/i, /\benterprise software\b/i, /\benterprise applications?\b/i, /\bbusiness systems?\b/i],
  integration: [/\bsystems? integration\b/i, /\bintegrations?\b/i],
  transformation: [/\b(digital|technology|it|enterprise|data) transformation\b/i, /\btransformation initiatives?\b/i],
  agile: [/\bagile\b/i, /\bscrum\b/i, /\bsafe\b/i, /\bhybrid delivery\b/i],
  data: [/\bdata platform(s)?\b/i, /\bdata warehouse\b|\bdwh\b/i, /\bpower bi\b|\bbi\b/i, /\bdata engineering\b/i],
  financial: [/\bfinancial it\b/i, /\bfintech\b/i, /\bbanking\b|\bbank\b/i, /\btrading\b/i, /\bpost[- ]trade\b/i, /\bpayments?\b/i],
  regulatory: [/\bregulatory\b/i, /\bcompliance\b/i, /\baml\b/i, /\brisk & compliance\b/i],
  governance: [/\bgovernance\b/i, /\bpmo\b/i, /\bsteerco\b|\bsteering committee\b/i],
  risk_dependency: [/\brisk (management|control|reporting)?\b/i, /\brisks?\b/i, /\bdependencies\b/i, /\braid\b/i],
  stakeholders: [/\bstakeholder (management|alignment|communication|expectations)\b/i, /\bsenior stakeholders?\b/i, /\bexecutive communication\b|\bexecutive reporting\b/i],
  budget: [/\bbudget(s|ing)?\b/i, /\bfinancial management\b/i, /\bfinancial control\b/i, /\bforecasting\b/i],
  release: [/\brelease readiness\b|\brelease\b/i, /\buat\b/i, /\bcutover\b/i, /\bgo[- ]live\b/i, /\bhypercare\b/i, /\bhandover\b/i],
  distributed: [/\bdistributed\b/i, /\boffshore\b/i, /\binternational teams?\b/i, /\bacross (countries|regions|denmark and india)\b/i],
  implementation: [/\bimplementation\b/i, /\bmigration\b/i, /\bdeployment\b/i, /\btransition\b/i],
  cloud: [/\bazure\b/i, /\bcloud\b/i, /\bdatabricks\b/i, /\bsnowflake\b/i],
}

function decodeEntities(value='') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
}

export function cleanHtml(value='') {
  return decodeEntities(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p>|<\/li>|<\/div>|<\/h\d>/gi,'\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/[ \t]+/g,' ')
    .replace(/\n[ \t]+/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
}

function norm(value='') { return cleanHtml(value).toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim() }
function matchCategories(text, defs){ const value=norm(text); return Object.fromEntries(Object.entries(defs).filter(([,patterns])=>patterns.some(rx=>rx.test(value)))) }
function sentences(text=''){ return cleanHtml(text).split(/(?<=[.!?;])\s+|\n+/).map(x=>x.trim()).filter(Boolean) }
function safeDate(value){ const d=value?new Date(value):null; return d && Number.isFinite(d.getTime())?d:null }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)) }
function round1(v){ return Math.round(v*10)/10 }

export function extractJobId(url='') {
  const decoded=decodeEntities(url)
  const match=decoded.match(/\/jobs\/view\/(?:[^/?#]*-)?(\d{7,})(?:[/?#]|$)/i) || decoded.match(/[?&](?:currentJobId|jobId)=(\d{7,})/i)
  return match?.[1] || null
}

function attr(tag,name){ const m=String(tag).match(new RegExp(`${name}=["']([^"']+)["']`,'i')); return m?decodeEntities(m[1]):'' }
function classText(block,classNeedle){ const rx=new RegExp(`<[^>]+class=["'][^"']*${classNeedle}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,'i'); const m=block.match(rx); return m?cleanHtml(m[1]):'' }

export function parseSearchHtml(html='') {
  const lower=String(html).toLowerCase()
  if (/captcha|challenge\/checkpoint|authwall/.test(lower)) throw new Error('LinkedIn public search returned an access wall/challenge')
  const blocks=String(html).match(/<li\b[\s\S]*?<\/li>/gi) || []
  const rows=[]; const seen=new Set()
  for(const block of blocks){
    const a=block.match(/<a\b[^>]*href=["']([^"']*\/jobs\/view\/[^"']+)["'][^>]*>/i)
    if(!a) continue
    const id=extractJobId(a[1]); if(!id||seen.has(id)) continue
    seen.add(id)
    const timeTag=block.match(/<time\b[^>]*>/i)?.[0] || ''
    rows.push({
      jobId:id,
      url:`${LINKEDIN_JOB}${id}/`,
      title:classText(block,'base-search-card__title'),
      company:classText(block,'base-search-card__subtitle'),
      location:classText(block,'job-search-card__location'),
      publishedAt:attr(timeTag,'datetime') || null,
    })
  }
  if(!rows.length && /\/jobs\/view\//i.test(html)) throw new Error('LinkedIn search HTML contains job links but no job cards were parsed')
  return rows
}

function parseJsonLdScripts(html=''){
  const out=[]
  for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const value=JSON.parse(m[1].trim())
      if(Array.isArray(value)) out.push(...value); else if(value?.['@graph']) out.push(...value['@graph']); else out.push(value)
    }catch{}
  }
  return out
}

function locationFromPosting(p){
  const locations=Array.isArray(p?.jobLocation)?p.jobLocation:[p?.jobLocation].filter(Boolean)
  const values=[]
  for(const x of locations){
    const a=x?.address||x
    const value=[a?.addressLocality,a?.addressRegion,a?.addressCountry?.name||a?.addressCountry].filter(Boolean).join(', ')
    if(value) values.push(value)
  }
  return [...new Set(values)].join(' / ')
}

function countryFromPosting(p){
  const locations=Array.isArray(p?.jobLocation)?p.jobLocation:[p?.jobLocation].filter(Boolean)
  for(const x of locations){ const a=x?.address||x; const c=a?.addressCountry?.name||a?.addressCountry; if(c) return cleanHtml(c) }
  return ''
}

function remoteType(location='',description=''){
  const loc=norm(location), text=norm(description)
  if(/\bhybrid\b/.test(loc)) return 'hybrid'
  if(/\bremote\b/.test(loc)) return 'remote'
  const hybrid=[/\bhybrid (work|working|role|position|setup|arrangement|workplace|schedule)\b/i,/\b(work|working) from home\b/i,/\bhome office\b/i,/\bremote.{0,35}days? per week\b/i,/\boffice.{0,45}(days? per week|days? a week|per quarter)\b/i,/\bwork remotely the other days\b/i,/\bfrom the office.{0,80}remotely the other days\b/i,/\bat least half \(50%\) of our time.{0,60}in the office\b/i]
  if(hybrid.some(rx=>rx.test(text))) return 'hybrid'
  const remote=[/\bfully remote\b/i,/\b100% remote\b/i,/\bremote (position|role|job|work arrangement)\b/i,/\bwork remotely\b/i]
  if(remote.some(rx=>rx.test(text))) return 'remote'
  const onsite=[/\b(on-site|onsite) (position|role|job)\b/i,/\boffice[- ]based\b/i,/\bwork from (the )?office\b/i,/\bphysical presence (will be )?required\b/i,/\brequired.{0,35}(physical presence|in the office|on-site|onsite)\b/i]
  if(onsite.some(rx=>rx.test(text))) return 'onsite'
  return 'unknown'
}

function remoteEligibility(description='',location='',type='unknown'){
  if(type!=='remote') return 'NOT APPLICABLE'
  const text=norm(`${location} ${description}`)
  if(/\b(only|limited to|must be based in)\b.{0,80}\b(germany|france|sweden|norway|netherlands|spain|portugal|poland)\b/i.test(text) && !/\bdenmark\b|\bdanmark\b/i.test(text)) return 'DENMARK EXCLUDED'
  const explicit=[/\bremote\s+(?:from\s+)?denmark\b/i,/\bdenmark\s+(?:is\s+)?(?:eligible|supported|included)\b/i,/\b(?:eu|eea|europe)\s+remote\b.{0,120}\bdenmark\b/i,/\bdenmark\b.{0,120}\b(?:employer of record|employment entity|payroll|remote)\b/i]
  return explicit.some(rx=>rx.test(text))?'DENMARK CONFIRMED':'UNVERIFIED'
}

function employmentType(posting,text=''){
  const value=norm(`${Array.isArray(posting?.employmentType)?posting.employmentType.join(' '):posting?.employmentType||''} ${text}`)
  if(/\b(full[- ]?time|permanent|fastansættelse)\b/.test(value)) return 'permanent'
  if(/\b(contract|freelance|konsulent)\b/.test(value)) return 'contract'
  if(/\b(temporary|fixed[- ]term|tidsbegrænset)\b/.test(value)) return 'fixed-term'
  return 'unknown'
}

export function salaryMonthlyDkk(text=''){
  const value=cleanHtml(text)
  const amount=raw=>{ const digits=String(raw).replace(/[.,]00$/,'').replace(/[^0-9]/g,''); const n=Number(digits); return n>=10000&&n<=250000?n:null }
  const patterns=[
    /(?:DKK|kr\.?)?\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*(?:DKK|kr\.?)?\s*[-–—]\s*(?:DKK|kr\.?)?\s*([0-9]{2,3}(?:[.,][0-9]{3})?(?:,[0-9]{2})?)\s*(?:DKK|kr\.?)?\s*(?:\/md\.?|pr\.? måned|per month|\/month|monthly)/i,
    /(?:DKK|kr\.?)\s*([0-9]{2,3}(?:[.,][0-9]{3})?)\s*[-–—]\s*(?:DKK|kr\.?)?\s*([0-9]{2,3}(?:[.,][0-9]{3})?)\s*(?:per month|\/month|monthly|pr\.? måned)/i,
  ]
  for(const rx of patterns){ const m=value.match(rx); if(m){ const a=amount(m[1]),b=amount(m[2]); if(a&&b) return [Math.min(a,b),Math.max(a,b)] } }
  return [null,null]
}

function parseDeadline(description='',referenceYear=new Date().getUTCFullYear()){
  const months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,januar:1,februar:2,marts:3,maj:5,juni:6,juli:7,oktober:10}
  const m=cleanHtml(description).match(/(?:deadline for application|application deadline|apply by|ansøgningsfrist)\s*[:\-]?\s*([0-3]?[0-9])(?:st|nd|rd|th)?\s+([A-Za-zæøåÆØÅ]+)(?:\s+(20[0-9]{2}))?/i)
  if(!m) return null
  const month=months[m[2].toLowerCase()]; if(!month) return null
  const d=new Date(Date.UTC(Number(m[3]||referenceYear),month-1,Number(m[1]),23,59,59)); return Number.isFinite(d.getTime())?d:null
}

function externalApplyUrl(html=''){
  for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)){
    const href=decodeEntities(m[1]); if(!/^https?:\/\//i.test(href)) continue
    try{ const u=new URL(href); if(!u.hostname.endsWith('linkedin.com')) return href }catch{}
  }
  return null
}

export function parseDetailHtml(row,html='',now=new Date()){
  const lower=String(html).toLowerCase(); if(/captcha|challenge\/checkpoint|authwall/.test(lower)) throw new Error('LinkedIn public job page returned an access wall/challenge')
  const postings=parseJsonLdScripts(html).filter(x=>x?.['@type']==='JobPosting')
  const p=postings[0]||{}
  let description=cleanHtml(p.description||'')
  if(!description){
    const m=String(html).match(/<div\b[^>]*class=["'][^"']*show-more-less-html__markup[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    description=cleanHtml(m?.[1]||'')
  }
  if(description.length<350) return null
  const title=cleanHtml(p.title||row.title||'')
  const company=cleanHtml(p.hiringOrganization?.name||row.company||'')
  const location=cleanHtml(locationFromPosting(p)||row.location||'Denmark')
  const publishedAt=p.datePosted||row.publishedAt||null
  const deadline=safeDate(p.validThrough)||parseDeadline(description,now.getUTCFullYear())
  const type=remoteType(location,description)
  const eligibility=remoteEligibility(description,location,type)
  const [salaryMinDkkMonth,salaryMaxDkkMonth]=salaryMonthlyDkk(description)
  const closed=Boolean((deadline && deadline.getTime()<now.getTime()) || /no longer accepting applications|modtager ikke længere ansøgninger|tager ikke længere imod ansøgninger/i.test(cleanHtml(html)))
  return {
    source:'LinkedIn Jobs', sourceJobId:String(row.jobId), originalUrl:`${LINKEDIN_JOB}${row.jobId}/`, officialUrl:null,
    title, company, location, country:countryFromPosting(p)||'', description, publishedAt, deadline:deadline?.toISOString()||null,
    remoteType:type, remoteEligibility:eligibility, employmentType:employmentType(p,description), salaryMinDkkMonth, salaryMaxDkkMonth,
    vacancyStatus:closed?'CLOSED':'ACTIVE VIA THIRD PARTY', fullJdVerified:true,
  }
}

function mandatoryDanish(text=''){
  for(const sentence of sentences(text)){
    const s=norm(sentence); if(!/\b(danish|dansk)\b/.test(s)) continue
    if(/\b(not required|not mandatory|optional|preferred|an advantage|advantage|nice to have|beneficial|plus|desirable)\b/.test(s)) continue
    if(/\b(danish|dansk)\b.{0,55}\b(is required|required|mandatory|must|proficient|proficiency|fluent|fluency|professional|native|near-native|kræves|påkrævet|flydende)\b/i.test(s) || /\b(required|mandatory|must|proficient|proficiency|fluent|fluency|professional|native|near-native|kræves|påkrævet|flydende)\b.{0,55}\b(danish|dansk)\b/i.test(s) || /\b(speak|write|communicate in)\b.{0,30}\b(danish|dansk)\b.{0,30}\b(fluently|professionally)\b/i.test(s)) return true
  }
  return false
}

function constructionPrimary(job){
  const text=norm(`${job.title} ${job.description}`)
  const hit=[/\bconstruction project(s)?\b/i,/\bbuilding construction\b/i,/\bcivil engineering\b/i,/\bconstruction site\b/i,/\bsite manager\b/i,/\bcapital construction\b/i,/\bbuilding project(s)?\b/i,/\bmep\b.{0,30}\b(construction|building|contractor)\b/i].some(rx=>rx.test(text))
  if(!hit) return false
  const tech=Object.keys(matchCategories(text,TECHNOLOGY_CATEGORIES)).length
  const corporate=/\b(corporate it|group it|enterprise software|digital transformation|systems integration|cloud platform|enterprise applications|business systems)\b/i.test(text)
  return !corporate || tech<=1
}

function rndPrimary(job){
  const title=norm(job.title), body=norm(job.description), tech=Object.keys(matchCategories(body,TECHNOLOGY_CATEGORIES)).length
  const corporate=/\b(corporate it|group it|enterprise (software|platform|applications)|digital transformation|it transformation|business systems|technology platform)\b/i.test(body)
  if(/\b(r&d|research|drug discovery|laboratory|medical device r&d|hardware development|computer vision)\b/i.test(title) && !corporate) return true
  const patterns=[/\b(lead|manage|own|deliver|responsible for)\b.{0,70}\b(scientific research|research programme|drug discovery|laboratory development|hardware development|medical device development|new physical product|product r&d|computer vision)\b/i,/\b(scientific research|research programme|drug discovery|laboratory development|hardware development|medical device development|new physical product|product r&d|computer vision)\b.{0,70}\b(project|programme|program|development lifecycle|roadmap)\b/i]
  return patterns.some(rx=>rx.test(body)) && !corporate && tech<=1
}

function hardExclusion(job){
  const title=norm(job.title), text=`${job.title}\n${job.description}`
  if(!job.fullJdVerified) return 'Full Job Description has not been verified'
  if(job.vacancyStatus==='CLOSED') return 'Vacancy is closed or its explicit application deadline has passed'
  if(mandatoryDanish(text)) return 'Mandatory professional/fluent Danish is explicitly required'
  if(job.remoteType==='remote'&&job.remoteEligibility==='DENMARK EXCLUDED') return 'Remote role explicitly excludes employment from Denmark'
  if(/\b(assistant|coordinator)\b/i.test(title)&&!/\b(manager|lead)\b/i.test(title)) return 'Assistant / coordinator level role'
  if(constructionPrimary(job)) return 'Role is primarily construction / building / civil engineering delivery'
  if(rndPrimary(job)) return 'Role is primarily R&D / scientific / hardware product development'
  const tech=Object.keys(matchCategories(text,TECHNOLOGY_CATEGORIES)).length
  if(/\b(marketing campaign|creative agency|advertising campaign|brand campaign)\b/i.test(text)&&tech<=1) return 'Role is primarily marketing / creative project delivery without technology ownership'
  if(/\b(retail rollout|store rollout|shop rollout|store opening programme|store opening program)\b/i.test(text)&&tech<=1) return 'Role is primarily retail rollout without technology ownership'
  const resp=Object.keys(matchCategories(text,RESPONSIBILITY_CATEGORIES)).length
  const bau=(text.match(/\b(BAU|IT support|service operations|ticket ownership|service management|incident management|operational support)\b/gi)||[]).length
  const coord=(text.match(/\b(coordination|facilitation|meeting management|status reporting|backlog administration)\b/gi)||[]).length
  if(/\bno (meaningful )?ownership\b/i.test(text)||/\bwithout (meaningful )?ownership\b/i.test(text)) return 'Role is coordination-only with no meaningful delivery ownership'
  if(bau>=2&&resp<=2) return 'Role is primarily BAU / support / service operations'
  if(coord>=2&&resp<=2) return 'Role is primarily coordination/facilitation without delivery ownership'
  if(resp===0&&classifyRoleTitle(job.title).kind!=='target') return 'No meaningful delivery ownership is evidenced in the JD'
  return null
}

function responsibilityScore(job){
  const names=Object.keys(matchCategories(`${job.title} ${job.description}`,RESPONSIBILITY_CATEGORIES))
  let score=2.2+Math.min(6.6,names.length*.66)
  if(names.includes('end_to_end')) score+=.5
  if(names.includes('accountability_outcomes')) score+=.4
  if(names.includes('risk_dependencies')&&names.includes('scope_schedule')) score+=.3
  score=Math.min(10,score)
  const pretty={end_to_end:'end-to-end delivery',scope_schedule:'scope/timeline/milestones',risk_dependencies:'risks/dependencies',budget_financial:'budget/financial control',accountability_outcomes:'accountability/outcomes',cross_functional:'cross-functional delivery',stakeholders:'senior stakeholders',governance:'governance/reporting',roadmap_planning:'roadmap/planning',implementation_release:'implementation/release lifecycle',team_leadership:'team leadership'}
  return [round1(score), names.length?[`Delivery evidence: ${names.slice(0,6).map(x=>pretty[x]).join(', ')}`]:[], score<7?['Delivery ownership is weaker than the target profile']:[]]
}

function experienceScore(job,resume){
  const jd=`${job.title} ${job.description}`
  const tech=Object.keys(matchCategories(jd,TECHNOLOGY_CATEGORIES))
  const jdEv=matchCategories(jd,EVIDENCE_CATEGORIES), cvEv=matchCategories(resume,EVIDENCE_CATEGORIES)
  const overlap=Object.keys(EVIDENCE_CATEGORIES).filter(x=>jdEv[x]&&cvEv[x])
  const finance=FINTECH_TERMS.some(x=>norm(jd).includes(x)) || /\b(financial services|bank|banking|fintech|regulated industry|regulatory|compliance|risk & compliance)\b/i.test(jd)
  let score=2+Math.min(5,overlap.length*.58)+Math.min(1.6,tech.length*.32)
  if(finance&&(cvEv.financial||cvEv.regulatory)) score+=1.1
  score=Math.min(10,score)
  const pretty={project_delivery:'end-to-end delivery',platform:'enterprise/platform delivery',integration:'systems integration',transformation:'transformation',agile:'Agile/Hybrid',data:'data/BI',financial:'Financial IT',regulatory:'regulatory/compliance',governance:'governance/PMO',risk_dependency:'risk/dependency management',stakeholders:'stakeholder leadership',budget:'budget/financial control',release:'release/go-live',distributed:'distributed delivery',implementation:'implementation/migration',cloud:'cloud/Azure'}
  const notes=[],gaps=[]
  if(finance) notes.push('Financial IT / regulated-domain priority match')
  if(overlap.length) notes.push(`JD ↔ Source CV evidence: ${overlap.slice(0,6).map(x=>pretty[x]).join(', ')}`); else gaps.push('Direct JD ↔ Source CV evidence overlap is limited')
  if(!tech.length) gaps.push('Technology/digital scope is not explicit in the JD')
  return [round1(score),notes,gaps]
}

function geographyScore(job){
  const loc=norm(job.location), notes=[],gaps=[]
  if(job.remoteType==='remote'){
    if(job.remoteEligibility==='DENMARK CONFIRMED') return [10,['Remote employment from Denmark is explicitly supported'],gaps]
    if(job.remoteEligibility==='UNVERIFIED') return [5,notes,['REMOTE ELIGIBILITY — UNVERIFIED']]
  }
  if(PREFERRED_LOCATIONS.some(x=>loc.includes(x))){ return job.remoteType==='hybrid'?[10,['Preferred geography + hybrid'],gaps]:[9,['Preferred geographic corridor'],gaps] }
  if(/copenhagen|københavn|capital region|hovedstaden/.test(loc)){
    if(job.remoteType==='hybrid') return [8,['Copenhagen / Capital Region hybrid'],gaps]
    if(job.remoteType==='onsite') return [5.5,notes,['Central Copenhagen onsite attendance may be unattractive']]
    return [7,['Copenhagen / Capital Region; work model not verified'],gaps]
  }
  if(/denmark|danmark/.test(loc)||/denmark|danmark/.test(norm(job.country))) return [5,notes,['Location is in Denmark but outside the preferred corridor']]
  return [2,notes,['Location is outside the target Denmark geography']]
}

function careerScore(job){
  const title=norm(job.title), body=norm(job.description), notes=[],gaps=[]; let score=5.5
  if(/\b(senior|lead|principal)\b/.test(title)){score+=1.5;notes.push('Senior/lead positioning is preserved')} else if(/\b(manager|program|programme|projektleder)\b/.test(title)) score+=.5
  const people=[/\bmanage a team of project managers\b/,/\bmanaging a team of project managers\b/,/\bhiring and retaining\b/,/\bperformance management\b/,/\bmanaging aspirations\b/,/\bresource utilization\b/].filter(rx=>rx.test(body)).length
  if(people>=2){score-=2;gaps.push('Role carries substantial people-management responsibility relative to hands-on delivery')}
  if(/\b(only for selected|selected high-stakes|direct .* accountability only for selected)\b/.test(body)&&/\bportfolio\b/.test(body)){score-=.7;gaps.push('Direct project ownership appears limited to selected initiatives')}
  return [round1(clamp(score,0,10)),notes,gaps]
}

export function evaluateJob(job,resume){
  const sourceCv=String(resume??'').trim()
  if(sourceCv.length<100) throw new Error('Source CV text is required for job evaluation.')
  const exclusion=hardExclusion(job)
  if(exclusion) return {score:0,verdict:'Poor fit',action:'Reject',match:[],gaps:[exclusion],hardExclusion:true,breakdown:{responsibilitiesDelivery:0,experienceDomain:0,geographyWorkModel:0,careerCompensation:0}}
  const [r,rn,rg]=responsibilityScore(job),[e,en,eg]=experienceScore(job,sourceCv),[g,gn,gg]=geographyScore(job),[c,cn,cg]=careerScore(job)
  const score=round1(r*.40+e*.25+g*.20+c*.15)
  const verdict=score>=9?'Strong fit':score>=7.5?'Plausible fit':score>=6?'Stretch fit':'Poor fit'
  const action=score>=9?'Apply':score>=7.5?'Consider':score>=6?'Hold':'Reject'
  return {score,verdict,action,match:[...rn,...en,...gn,...cn].slice(0,4),gaps:[...rg,...eg,...gg,...cg].slice(0,3),hardExclusion:false,breakdown:{responsibilitiesDelivery:r,experienceDomain:e,geographyWorkModel:g,careerCompensation:c}}
}

export function discoveryCandidate(job){
  const title=norm(job.title), desc=norm(job.description)
  if(TITLE_SIGNALS.some(x=>title.includes(x))) return true
  return Object.keys(matchCategories(desc,TECHNOLOGY_CATEGORIES)).length>=2 && Object.keys(matchCategories(desc,RESPONSIBILITY_CATEGORIES)).length>=2
}

async function fetchHtml(url,{attempts=1,timeoutMs=7000}={}){
  let last
  for(let i=0;i<attempts;i++){
    try{
      const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36','Accept-Language':'en-US,en;q=0.9,da;q=0.8','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)})
      if(!res.ok) throw new Error(`LinkedIn HTTP ${res.status}`)
      const text=await res.text(); const ctype=(res.headers.get('content-type')||'').toLowerCase()
      if(!ctype.includes('html')&&!/<html/i.test(text.slice(0,800))) throw new Error(`Unexpected LinkedIn content type: ${ctype||'unknown'}`)
      if(/captcha|challenge\/checkpoint|authwall/i.test(text)) throw new Error('LinkedIn public page returned an access wall/challenge')
      return text
    }catch(err){ last=err; if(i<attempts-1) await new Promise(r=>setTimeout(r,250*(i+1))) }
  }
  throw last
}

async function mapLimit(items,limit,fn){
  const results=new Array(items.length); let next=0
  async function worker(){ while(true){ const i=next++; if(i>=items.length) return; try{results[i]={status:'fulfilled',value:await fn(items[i],i)}}catch(reason){results[i]={status:'rejected',reason}} } }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker)); return results
}

export async function searchLinkedIn({freshnessDays=7,resume,maxDetails=24,fetcher=fetchHtml,now=new Date()}={}){
  const sourceCv=String(resume??'').trim()
  if(sourceCv.length<100) throw new Error('Source CV text is required for LinkedIn evaluation.')
  const seconds=Math.max(86400,Number(freshnessDays||7)*86400)
  const diagnostics={searchRequests:0,searchFailures:0,searchRows:0,detailRequests:0,detailFailures:0,incompleteDetails:0}
  const searchResults=await mapLimit(DISCOVERY_QUERIES,5,async query=>{
    diagnostics.searchRequests++
    const qs=new URLSearchParams({keywords:query,location:'Denmark',f_TPR:`r${seconds}`,sortBy:'DD',start:'0'})
    const html=await fetcher(`${LINKEDIN_SEARCH}?${qs}`)
    return parseSearchHtml(html)
  })
  const errors=[],rows=[]
  for(const r of searchResults){ if(r.status==='fulfilled'){rows.push(...r.value);diagnostics.searchRows+=r.value.length}else{diagnostics.searchFailures++;errors.push(String(r.reason?.message||r.reason))} }
  if(diagnostics.searchFailures===diagnostics.searchRequests) throw new Error(`LinkedIn public search unavailable: ${errors[0]||'all search requests failed'}`)
  const byId=new Map(); for(const row of rows) if(!byId.has(row.jobId)) byId.set(row.jobId,row)
  const unique=[...byId.values()].sort((a,b)=>(safeDate(b.publishedAt)?.getTime()||0)-(safeDate(a.publishedAt)?.getTime()||0)).slice(0,maxDetails)
  const details=await mapLimit(unique,8,async row=>{
    diagnostics.detailRequests++
    const html=await fetcher(`${LINKEDIN_JOB_DETAIL}${row.jobId}`)
    return parseDetailHtml(row,html,now)
  })
  const jobs=[]
  for(const d of details){ if(d.status==='fulfilled'){if(d.value) jobs.push(d.value); else diagnostics.incompleteDetails++} else {diagnostics.detailFailures++;errors.push(String(d.reason?.message||d.reason))} }
  if(unique.length>0&&jobs.length===0&&diagnostics.detailFailures+diagnostics.incompleteDetails===unique.length) throw new Error(`LinkedIn job details unavailable: ${errors.at(-1)||'no full JD could be read'}`)
  const evaluated=[]
  for(const job of jobs){ const published=safeDate(job.publishedAt); if(published && (now.getTime()-published.getTime())>Number(freshnessDays||7)*86400000+21600000) continue; if(!discoveryCandidate(job)) continue; const evaluation=evaluateJob(job,sourceCv); if(evaluation.hardExclusion||evaluation.verdict==='Poor fit') continue; evaluated.push({job,evaluation}) }
  evaluated.sort((a,b)=>b.evaluation.score-a.evaluation.score || (safeDate(b.job.publishedAt)?.getTime()||0)-(safeDate(a.job.publishedAt)?.getTime()||0))
  const coverage=diagnostics.searchFailures||diagnostics.detailFailures?'ACCESS LIMITED':evaluated.length?'SEARCHED':'NO RELEVANT RESULTS'
  return {jobs:evaluated.slice(0,10),coverage:{source:'LinkedIn Jobs',status:coverage,detail:errors[0]||null},stats:{discovered:unique.length,fullJdVerified:jobs.length,evaluated:evaluated.length,returned:Math.min(10,evaluated.length)},diagnostics}
}
