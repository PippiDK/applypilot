import test from 'node:test'
import assert from 'node:assert/strict'
import { ennovaMindkeyDetailUrl, recoverExternalFullJd, recoverJobindexCanonicalFullJd } from './jobindex-live-retrieval.js'
import { searchJobindexSource } from './jobindex-source-adapter.js'

const long=text=>String(text).repeat(14)
function response(body,{status=200,url='',contentType='text/html; charset=utf-8'}={}){
  return {ok:status>=200&&status<300,status,url,headers:{get:name=>String(name).toLowerCase()==='content-type'?contentType:''},text:async()=>body}
}
function rss(id,title){return `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>https://www.jobindex.dk/vis-job/${id}</link><description><![CDATA[<p>Relevant role.</p>]]></description></item></channel></rss>`}
function teaser({title,applicationUrl='',canonicalUrl=''}={}){
  return `<html><head>${canonicalUrl?`<link href="${canonicalUrl}" rel="canonical">`:''}<meta content="${title}" property="og:title"></head><body><div class="jix-toolbar-top__company">Acme A/S</div><div class="PaidJob-inner"><h4>${applicationUrl?`<a href="${applicationUrl}">${title}</a>`:title}</h4><div class="jobad-element-area"><span class="jix_robotjob--area">Copenhagen</span></div><p>Short teaser only.</p></div><div class="jix_toolbar jix_appetizer_toolbar"><div class="jix-toolbar__pubdate"><time datetime="2026-08-31">31-08-2026</time></div></div></body></html>`
}

test('recovers nested Ege Carpets job-detail-description without truncating at inner divs',()=>{
  const body=long('Own IT support, Microsoft 365, Intune, incidents, service desk and implementation work. ')
  const html=`<div class="job-detail-description"><div class="intro">Intro</div><div class="body"><p>${body}</p></div></div>`
  const jd=recoverExternalFullJd(html,'https://www.egecarpets.com/da-dk/job/3410')
  assert.ok(jd.length>700); assert.match(jd,/Microsoft 365/i)
})

test('recovers Cloudcruit col1 vacancy body',()=>{
  const body=long('Technical service, support, software, electronics, customers and product responsibility. ')
  const html=`<div class="cols"><div class="col1"><div><h1>Technical specialist</h1></div><p>${body}</p></div><div class="col2">Sidebar only</div></div>`
  const jd=recoverExternalFullJd(html,'https://cloudcruit.cruitconsult.dk/annonce.asp?AdvertID=255')
  assert.ok(jd.length>700); assert.match(jd,/Technical service/i); assert.doesNotMatch(jd,/Sidebar only/i)
})

test('recovers Avature article--details vacancy body',()=>{
  const body=long('Maintain regulatory requirements, submissions, technical documentation, project cooperation and market clearance. ')
  const html=`<article class="article article--details js_collapsible"><div class="article__content"><div><p>Your Job</p><p>${body}</p></div></div></article>`
  const jd=recoverExternalFullJd(html,'https://koch.avature.net/en_US/careers/JobDetail/Regulatory-Affairs-Specialist/193263')
  assert.ok(jd.length>700); assert.match(jd,/regulatory requirements/i)
})

test('recovers long YoungCRM og description',()=>{
  const body=long('Coordinate project execution, deadlines, customers, suppliers, orders, changes and deliveries. ')
  const html=`<meta property="og:description" content="${body}">`
  const jd=recoverExternalFullJd(html,'https://ilva.youngcrm.com/jobportal/12750')
  assert.ok(jd.length>700); assert.match(jd,/project execution/i)
})

test('recovers Brinch Partners Elementor vacancy body without application or contact noise',()=>{
  const body=long('As Senior HR Business Partner you advise leaders, drive organisational development, improve HR processes and implement the Cornerstone HR platform. ')
  const html=`<html><body class="single-stillinger"><div class="elementor-widget-theme-post-content"><div class="elementor-widget-container"><p class="wp-block-paragraph">Senior HR Business Partner</p><p class="wp-block-paragraph"><strong>Your responsibilities</strong></p><div><p class="wp-block-paragraph">${body}</p></div><p class="wp-block-paragraph"><strong>Your Experience and Skills</strong></p></div></div><div class="elementor-widget-shortcode"><iframe src="https://brinchpartners.teamtailor.com/en/jobs/8023489/applications/new"></iframe><p>APPLICATION FORM NOISE</p></div><div class="jet-listing-grid">CONTACT TEAM NOISE</div></body></html>`
  const jd=recoverExternalFullJd(html,'https://brinchpartners.dk/stillinger/12-904/')
  assert.ok(jd.length>700)
  assert.match(jd,/Your responsibilities/i)
  assert.match(jd,/Cornerstone HR platform/i)
  assert.doesNotMatch(jd,/APPLICATION FORM NOISE|CONTACT TEAM NOISE/i)
})

test('does not treat generic Brinch Partners pages as vacancy bodies',()=>{
  const html=`<div class="elementor-widget-theme-post-content"><div class="elementor-widget-container"><p>${long('Company services and recruitment consulting information. ')}</p></div></div>`
  assert.equal(recoverExternalFullJd(html,'https://brinchpartners.dk/ydelser/'),'')
})

test('recovers custom Jobindex jobadd canonical body',()=>{
  const body=long('Drive technical projects from scope and planning through safe execution, contractor management and stakeholder alignment. ')
  const html=`<div class="container-fluid jobcontent"><div class="jobadd"><div class="intro">Intro</div><p>${body}</p></div></div>`
  const jd=recoverJobindexCanonicalFullJd(html,'https://www.jobindex.dk/jobannonce/h1693594/selvdreven-projektleder')
  assert.ok(jd.length>700); assert.match(jd,/safe execution/i)
})

test('builds only the Ennova Mindkey detail URL with the live VID',()=>{
  const wrapper='https://www.ennova.com/en/ennova-career-job?VID=20260818'
  const html=`<script>iframe.src="https://mkjobennova.azurewebsites.net/en-us/details.aspx" + window.location.search</script>`
  assert.equal(ennovaMindkeyDetailUrl(wrapper,html),'https://mkjobennova.azurewebsites.net/en-us/details.aspx?VID=20260818')
  assert.equal(ennovaMindkeyDetailUrl('https://evil.example/?VID=20260818',html),'')
})

test('adapter follows Ennova Mindkey iframe and verifies full JD',async()=>{
  const title='IT Project Manager'
  const wrapper='https://www.ennova.com/en/ennova-career-job?VID=20260818'
  const frame='https://mkjobennova.azurewebsites.net/en-us/details.aspx?VID=20260818'
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss('h1001',title))
    if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(teaser({title,applicationUrl:wrapper}))
    if(String(url)===wrapper) return response(`<script>iframe.src="https://mkjobennova.azurewebsites.net/en-us/details.aspx" + window.location.search</script>`,{url:wrapper})
    if(String(url)===frame) return response(`<div class="vacancy_details"><h1>${title}</h1><p>${long('Lead IT projects, delivery, operations, Microsoft platforms and stakeholders. ')}</p></div>`,{url:frame})
    throw new Error(`unexpected ${url}`)
  }
  const result=await searchJobindexSource({unionSearchPlan:{directions:[{role:title,query:title,tier:'primary'}]},maxPages:1,fetcher})
  assert.equal(result.stats.limitedData,0); assert.equal(result.stats.fullJdVerified,1); assert.ok(seen.includes(frame)); assert.match(result.jobs[0].fullJd,/Lead IT projects/i)
})

test('adapter uses custom Jobindex canonical body before broken employer application page',async()=>{
  const title='Project Manager'
  const canonical='https://www.jobindex.dk/jobannonce/h1001/project-manager'
  const employer='https://career.example.invalid/jobs'
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss('h1001',title))
    if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(teaser({title,applicationUrl:employer,canonicalUrl:canonical}))
    if(String(url)===canonical) return response(`<div class="jobadd"><div>Intro</div><p>${long('Drive technical projects from planning through execution, risks and stakeholders. ')}</p></div>`,{url:canonical})
    throw new Error(`unexpected ${url}`)
  }
  const result=await searchJobindexSource({unionSearchPlan:{directions:[{role:title,query:title,tier:'primary'}]},maxPages:1,fetcher})
  assert.equal(result.stats.limitedData,0); assert.equal(result.stats.fullJdVerified,1); assert.ok(seen.includes(canonical)); assert.ok(!seen.includes(employer)); assert.match(result.jobs[0].fullJd,/technical projects/i)
})
