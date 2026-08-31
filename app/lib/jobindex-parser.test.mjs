import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJobindexSearchRecords, extractJobindexDetail, extractJobindexExternalDetail, extractOracleCandidateExperienceDetail, jobindexDetailUrl } from './jobindex-parser.js'

const substantive=(text='Lead enterprise project delivery across scope, risks, dependencies, vendors and senior stakeholders. ')=>text.repeat(12)

test('extracts stable Jobindex ids once and ignores unrelated hrefs', () => {
  const html=`<a href="/vis-job/h1693319">Role</a><a href="/company/acme">Acme</a><a href="https://www.jobindex.dk/vis-job/h1693319">Role duplicate</a><a href="/vis-job/not-a-job">No</a>`
  const records=extractJobindexSearchRecords(html)
  assert.deepEqual(records.map(record=>record.jobId),['h1693319'])
  assert.equal(records[0].detailUrl,'https://www.jobindex.dk/vis-job/h1693319')
})

test('RSS parser preserves title and teaser for discovery relevance checks', () => {
  const rss=`<?xml version="1.0"?><rss><channel><item><title>Technical Project Manager, Acme A&amp;S</title><link>https://www.jobindex.dk/vis-job/h1693319</link><description><![CDATA[<div><p>Lead complex technology projects across teams.</p></div>]]></description></item></channel></rss>`
  const records=extractJobindexSearchRecords(rss)
  assert.deepEqual(records,[{jobId:'h1693319',detailUrl:'https://www.jobindex.dk/vis-job/h1693319',title:'Technical Project Manager, Acme A&S',rssDescription:'Lead complex technology projects across teams.'}])
})

test('builds canonical detail URL', () => { assert.equal(jobindexDetailUrl('h1693319'),'https://www.jobindex.dk/vis-job/h1693319') })

test('detail parser reads JobPosting JSON-LD', () => {
  const html=`<html><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'JobPosting',title:'Senior Project Manager',hiringOrganization:{name:'Acme A/S'},jobLocation:{address:{addressLocality:'Copenhagen',addressCountry:'DK'}},datePosted:'2026-08-30',description:'<p>Lead complex delivery.</p>',url:'https://www.jobindex.dk/vis-job/h1693319',directApply:true})}</script><a rel="nofollow" href="https://acme.example/jobs/42">Søg jobbet</a></html>`
  const detail=extractJobindexDetail(html,{jobId:'h1693319'})
  assert.equal(detail.title,'Senior Project Manager'); assert.equal(detail.company,'Acme A/S'); assert.match(detail.location,/Copenhagen/); assert.equal(detail.country,'DK'); assert.equal(detail.postedDate,'2026-08-30'); assert.match(detail.fullJd,/Lead complex delivery/); assert.equal(detail.applicationUrl,'https://acme.example/jobs/42')
})

test('current Jobindex detail markup yields basic vacancy fields without treating teaser as full JD', () => {
  const html=`<html><head><meta content="Senior Delivery Manager" property="og:title"><meta content="Short teaser only." property="og:description"></head><body><div class="jix-toolbar-top__company"><a href="https://recruiter.example">Recruiter ApS</a> søger for Acme A/S</div><div class="PaidJob-inner"><h4><a href="https://acme.example/jobs/42">Senior Delivery Manager</a></h4><div class="jobad-element-area"><span class="jix_robotjob--area">Copenhagen</span></div><p>We use a hybrid working model.</p><p>This is only the Jobindex teaser.</p></div><div class="jix_toolbar jix_appetizer_toolbar"><div class="jix-toolbar__pubdate"><time datetime="2026-08-30">30-08-2026</time></div></div></body></html>`
  const detail=extractJobindexDetail(html,{jobId:'h1693319'})
  assert.equal(detail.title,'Senior Delivery Manager'); assert.equal(detail.company,'Acme A/S'); assert.equal(detail.location,'Copenhagen'); assert.equal(detail.postedDate,'2026-08-30'); assert.equal(detail.applicationUrl,'https://acme.example/jobs/42'); assert.equal(detail.remoteType,'hybrid'); assert.match(detail.teaser,/Jobindex teaser/); assert.equal(detail.fullJd,'')
})

test('external employer parser extracts only a substantive job-description container', () => {
  const body=substantive(); const html=`<html><body><nav>Navigation and unrelated links</nav><section class="full-detail-description full-detail"><div><h2>Stillingsbeskrivelse</h2><p>${body}</p><p>Application information for the role.</p></div></section><div class="consent-content">Privacy consent text that must not become part of the job description.</div><footer>Footer noise</footer></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://acme.example/jobs/42'}); assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/end-to-end delivery|enterprise project delivery/i); assert.doesNotMatch(detail.fullJd,/Privacy consent text/i)
})

test('external employer parser extracts Emply csa_jobadText', () => {
  const body=substantive(); const html=`<html><body><div class="csa_jobadLeft"><h1 class="css_headline">Senior Project Manager</h1><div class="csa_jobadText"><p>${body}</p></div></div><div class="content">Unrelated account content</div></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://acme.career.emply.com/en/ad/pm/id'}); assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/enterprise project delivery/i); assert.doesNotMatch(detail.fullJd,/Unrelated account content/i)
})

test('external employer parser extracts substantive SuccessFactors itemprop description', () => {
  const body=substantive('Own end-to-end IT delivery, service stability, vendors, risks and senior stakeholders. '); const html=`<html><body><span itemprop="description"></span><span xml:lang="en-US" itemprop="description" class="rtltextaligneligible"><h1>IT Service Delivery Manager</h1><p>${body}</p></span></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://jobs.example/job/it-service/1708-en_US/'}); assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/end-to-end IT delivery/i)
})

test('extracts Ege Carpets streamed Next.js job-detail-description',()=>{
  const html=`<html><body><header data-testid="job-detail-header"><h1>IT Supporter med ansvar for Servicedesk</h1></header><div class="job-detail-description"><p>${substantive('Own IT support, operations, Microsoft 365, Intune, incidents and implementation work. ')}</p></div></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://www.egecarpets.com/da-dk/om-ege-carpets/job-og-karriere/it-supporter-3410'})
  assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/Microsoft 365/i)
})

test('extracts Cloudcruit/cruitconsult col1 vacancy body',()=>{
  const html=`<html><body><div class="container"><div class="content"><div class="cols"><div class="col1"><h1>Technical specialist</h1><p>${substantive('Technical service, support, software, electronics, customers and product responsibility. ')}</p></div><div class="col2">Sidebar</div></div></div></div></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://cloudcruit.cruitconsult.dk/annonce.asp?AdvertID=255'})
  assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/Technical service/i); assert.doesNotMatch(detail.fullJd,/Sidebar/i)
})

test('extracts Avature article details body',()=>{
  const html=`<html><body><section class="section js_views"><div class="section__content"><article class="article article--details js_collapsible"><div class="article__content"><div class="article__content__view"><div class="article__content__view__field"><div class="article__content__view__field__value"><p>Your Job</p><p>${substantive('Maintain regulatory requirements, submissions, technical documentation, project cooperation and market clearance. ')}</p></div></div></div></div></article></div></section></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://koch.avature.net/en_US/careers/JobDetail/Regulatory-Affairs-Specialist/193263'})
  assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/regulatory requirements/i)
})

test('extracts long YoungCRM og description as the vacancy body',()=>{
  const body=substantive('Coordinate project execution, deadlines, customers, suppliers, orders, changes and deliveries. ')
  const html=`<html><head><meta property="og:title" content="Sales &amp; Project Coordinator"><meta property="og:description" content="${body}"></head><body><div id="app"></div></body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://ilva.youngcrm.com/jobportal/12750'})
  assert.ok(detail.fullJd.length>700); assert.match(detail.fullJd,/project execution/i)
})

test('Oracle CandidateExperience parser reads external requisition description', () => {
  const body='<p>'+substantive()+'</p>'; const payload=JSON.stringify({items:[{Id:'8022',Title:'Senior Project Manager',ExternalPostedStartDate:'2026-08-28T09:33:19+00:00',ExternalDescriptionStr:body,ExternalResponsibilitiesStr:'',ExternalQualificationsStr:'',PrimaryLocation:'Kongens Lyngby',PrimaryLocationCountry:'DK',WorkplaceType:'Hybrid',LegalEmployer:'Acme A/S'}]})
  const detail=extractOracleCandidateExperienceDetail(payload,{url:'https://tenant.oraclecloud.com/hcmUI/CandidateExperience/da/sites/CX_1/job/8022'}); assert.equal(detail.title,'Senior Project Manager'); assert.equal(detail.company,'Acme A/S'); assert.equal(detail.location,'Kongens Lyngby'); assert.equal(detail.country,'DK'); assert.equal(detail.remoteType,'hybrid'); assert.equal(detail.postedDate,'2026-08-28T09:33:19+00:00'); assert.ok(detail.fullJd.length>700)
})

test('external employer parser refuses generic page text when no reliable JD container exists', () => {
  const html=`<html><body><nav>${'Navigation '.repeat(100)}</nav><main><p>Company home page</p></main><footer>${'Footer '.repeat(100)}</footer></body></html>`; const detail=extractJobindexExternalDetail(html,{url:'https://acme.example/'}); assert.equal(detail.fullJd,'')
})

test('detail parser captures explicit remote and hybrid work-model signals', () => {
  const remoteHtml=`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',title:'Delivery Manager',jobLocationType:'TELECOMMUTE',description:'Remote role available from Denmark.'})}</script>`; const hybridHtml=`<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',title:'Delivery Manager',description:'We use a hybrid working model with office days in Copenhagen.'})}</script>`; assert.equal(extractJobindexDetail(remoteHtml,{jobId:'h2'}).remoteType,'remote'); assert.equal(extractJobindexDetail(hybridHtml,{jobId:'h3'}).remoteType,'hybrid')
})

test('missing optional fields do not throw', () => { const detail=extractJobindexDetail('<html></html>',{jobId:'h1'}); assert.equal(detail.title,''); assert.equal(detail.fullJd,'') })
