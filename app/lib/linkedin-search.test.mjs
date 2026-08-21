import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSearchHtml, parseDetailHtml, evaluateJob, salaryMonthlyDkk, searchLinkedIn, MASTER_CV_TEXT } from './linkedin-search.js'

const SEARCH_HTML=`<!doctype html><html><body><ul>
<li><div class="base-card"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/software-execution-lead-at-velux-4440077540?trk=x"></a><h3 class="base-search-card__title">Software Execution Lead</h3><h4 class="base-search-card__subtitle">VELUX</h4><span class="job-search-card__location">Hørsholm, Capital Region of Denmark, Denmark</span><time datetime="2026-08-20"></time></div></li>
</ul></body></html>`

function detailHtml({title='Software Execution Lead',company='VELUX',location='Hørsholm',country='Denmark',date='2026-08-20',validThrough='2026-09-01',description}={}){
 const desc=description||`Lead end-to-end software delivery and execution across engineering teams. Own project scope, timelines, milestones, risks, dependencies and delivery outcomes. Manage roadmap and governance, senior stakeholders and executive reporting. Coordinate cross-functional technology teams and implementation through release readiness, UAT, go-live and operational handover. This role works with enterprise platforms and systems integration in an international Agile environment. Budget responsibility is part of the role. English is required; Danish is an advantage. `.repeat(2)
 const data={"@context":"https://schema.org","@type":"JobPosting",title,datePosted:date,validThrough,employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:company},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:location,addressCountry:country}},description:desc}
 return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${desc}</div></body></html>`
}

test('parses LinkedIn public search card',()=>{
 const rows=parseSearchHtml(SEARCH_HTML)
 assert.equal(rows.length,1); assert.equal(rows[0].jobId,'4440077540'); assert.equal(rows[0].title,'Software Execution Lead'); assert.equal(rows[0].company,'VELUX')
})

test('parses full JD from JobPosting JSON-LD',()=>{
 const job=parseDetailHtml(parseSearchHtml(SEARCH_HTML)[0],detailHtml(),new Date('2026-08-21T12:00:00Z'))
 assert.ok(job); assert.equal(job.fullJdVerified,true); assert.equal(job.company,'VELUX'); assert.match(job.description,/end-to-end software delivery/i); assert.equal(job.vacancyStatus,'ACTIVE VIA THIRD PARTY')
})

test('hybrid delivery methodology is not treated as hybrid work model',()=>{
 const d=`Lead end-to-end IT delivery using Agile and hybrid delivery approaches. Own scope, budget, risks, dependencies, governance, implementation and release outcomes with technology teams. `.repeat(4)
 const job=parseDetailHtml(parseSearchHtml(SEARCH_HTML)[0],detailHtml({description:d}),new Date('2026-08-21T12:00:00Z'))
 assert.equal(job.remoteType,'unknown')
})

test('Danish preferred is not a hard reject',()=>{
 const job=parseDetailHtml(parseSearchHtml(SEARCH_HTML)[0],detailHtml(),new Date('2026-08-21T12:00:00Z'))
 const result=evaluateJob(job,MASTER_CV_TEXT); assert.equal(result.hardExclusion,false); assert.ok(result.score>=6)
})

test('mandatory Danish is a hard reject',()=>{
 const d=`Lead end-to-end IT project delivery with technology teams, scope, milestones, risks, dependencies, budget and governance. Fluency in English and Danish is mandatory. `.repeat(4)
 const job=parseDetailHtml(parseSearchHtml(SEARCH_HTML)[0],detailHtml({description:d}),new Date('2026-08-21T12:00:00Z'))
 const result=evaluateJob(job); assert.equal(result.hardExclusion,true); assert.match(result.gaps[0],/Mandatory/i)
})

test('construction PM is rejected even with generic PM language',()=>{
 const d=`Senior Project Manager delivering building construction projects and data centres. Manage contractors, MEP, construction site interfaces, budget, risks, milestones, governance and senior stakeholders. `.repeat(4)
 const job=parseDetailHtml({...parseSearchHtml(SEARCH_HTML)[0],title:'Senior Project Manager'},detailHtml({title:'Senior Project Manager',description:d}),new Date('2026-08-21T12:00:00Z'))
 const result=evaluateJob(job); assert.equal(result.hardExclusion,true); assert.match(result.gaps[0],/construction/i)
})

test('corporate IT in research-heavy company is not rejected as R&D',()=>{
 const d=`Lead end-to-end Corporate IT delivery of an enterprise platform used by scientific research and drug discovery teams. This is Group IT and enterprise software, not product R&D. Own scope, timeline, budget, risks, dependencies, governance, systems integration and go-live. `.repeat(4)
 const job=parseDetailHtml({...parseSearchHtml(SEARCH_HTML)[0],title:'Senior IT Project Manager'},detailHtml({title:'Senior IT Project Manager',company:'PharmaCo',description:d}),new Date('2026-08-21T12:00:00Z'))
 const result=evaluateJob(job); assert.equal(result.hardExclusion,false)
})

test('remote Europe does not prove Denmark eligibility',()=>{
 const d=`Fully remote role in Europe. Lead end-to-end software platform delivery with scope, budget, risks, dependencies, technology teams, governance and implementation outcomes. `.repeat(4)
 const job=parseDetailHtml({...parseSearchHtml(SEARCH_HTML)[0],title:'Senior IT Project Manager'},detailHtml({title:'Senior IT Project Manager',location:'Remote Europe',country:'',description:d}),new Date('2026-08-21T12:00:00Z'))
 assert.equal(job.remoteType,'remote'); assert.equal(job.remoteEligibility,'UNVERIFIED'); assert.equal(evaluateJob(job).breakdown.geographyWorkModel,5)
})

test('monthly DKK salary range is parsed conservatively',()=>{
 assert.deepEqual(salaryMonthlyDkk('Salary 50.000–75.000 DKK per month'),[50000,75000])
 assert.deepEqual(salaryMonthlyDkk('Salary DKK 900,000–1,000,000 per year'),[null,null])
})

test('expired explicit validThrough closes vacancy',()=>{
 const job=parseDetailHtml(parseSearchHtml(SEARCH_HTML)[0],detailHtml({validThrough:'2026-08-20'}),new Date('2026-08-21T12:00:00Z'))
 assert.equal(job.vacancyStatus,'CLOSED'); assert.equal(evaluateJob(job).hardExclusion,true)
})

test('one-source E2E: LinkedIn guest search -> guest detail -> evaluator returns VELUX fixture',async()=>{
 const urls=[]
 const fetcher=async url=>{ urls.push(url); return url.includes('/seeMoreJobPostings/search')?SEARCH_HTML:detailHtml() }
 const result=await searchLinkedIn({freshnessDays:7,fetcher,now:new Date('2026-08-21T12:00:00Z')})
 assert.match(urls[0],/\/jobs-guest\/jobs\/api\/seeMoreJobPostings\/search/)
 assert.ok(urls.some(url=>/\/jobs-guest\/jobs\/api\/jobPosting\/4440077540/.test(url)))
 assert.equal(result.stats.discovered,1); assert.equal(result.stats.fullJdVerified,1); assert.equal(result.jobs.length,1); assert.equal(result.jobs[0].job.company,'VELUX'); assert.ok(result.jobs[0].evaluation.score>=6)
})

test('all LinkedIn search failures are surfaced, never fake zero results',async()=>{
 const fetcher=async()=>{throw new Error('LinkedIn HTTP 429')}
 await assert.rejects(()=>searchLinkedIn({fetcher}),/LinkedIn public search unavailable/)
})
