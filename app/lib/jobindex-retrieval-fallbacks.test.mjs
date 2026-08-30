import test from 'node:test'
import assert from 'node:assert/strict'
import { searchJobindexSource } from './jobindex-source-adapter.js'
import { extractJobindexExternalDetail } from './jobindex-parser.js'

function response(body,{status=200,url=''}={}){
  return {ok:status>=200&&status<300,status,url,text:async()=>body}
}
function rss(id,title){
  return `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>https://www.jobindex.dk/vis-job/${id}</link><description><![CDATA[<p>Relevant role.</p>]]></description></item></channel></rss>`
}
function teaserDetail({id,title,applicationUrl='',canonicalUrl=''}={}){
  const canonical=canonicalUrl?`<link href="${canonicalUrl}" rel="canonical">`:''
  const app=applicationUrl?`<a href="${applicationUrl}">${title}</a>`:''
  return `<html><head>${canonical}<meta content="${title}" property="og:title"></head><body>
    <div class="jix-toolbar-top__company">Acme A/S</div>
    <div class="PaidJob-inner"><h4>${app||title}</h4><div class="jobad-element-area"><span class="jix_robotjob--area">Copenhagen</span></div><p>Short teaser only.</p></div>
    <div class="jix_toolbar jix_appetizer_toolbar"><div class="jix-toolbar__pubdate"><time datetime="2026-08-30">30-08-2026</time></div></div>
  </body></html>`
}
function body(text='Lead enterprise project delivery across scope, risks, dependencies, vendors and senior stakeholders. '){return text.repeat(12)}
function input(role='Project Manager'){
  return {unionSearchPlan:{directions:[{role,tier:'primary',query:role}]},maxPages:1}
}

async function runOne({id='h1001',title='Project Manager',fetcher,role='Project Manager'}){
  return searchJobindexSource({...input(role),fetcher})
}

test('uses Jobindex canonical jobannonce body when the teaser page exposes a full-JD canonical URL',async()=>{
  const canonical='https://www.jobindex.dk/jobannonce/h1001/technical-project-manager'
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss('h1001','Technical Project Manager'))
    if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(teaserDetail({id:'h1001',title:'Technical Project Manager',canonicalUrl:canonical}))
    if(String(url)===canonical) return response(`<article><section class="jobtext-jobad__body"><p>${body()}</p></section></article>`,{url:canonical})
    throw new Error(`unexpected ${url}`)
  }
  const result=await runOne({title:'Technical Project Manager',fetcher,role:'Technical Project Manager'})
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
  assert.match(result.jobs[0].fullJd,/enterprise project delivery/i)
  assert.ok(seen.includes(canonical))
})

test('follows a labeled Jobindex apply tracker and resolves HR-manager application form to its advertisement page',async()=>{
  const tracker='https://www.jobindex.dk/c?t=e6266804&ctx=w'
  const applicationForm='https://candidate.hr-manager.net/ApplicationForm/SinglePageApplicationForm.aspx?cid=2273&departmentId=18963&ProjectId=143916&MediaId=4616'
  const advertisement='https://candidate.hr-manager.net/ApplicationInit.aspx?cid=2273&ProjectId=143916&DepartmentId=18963&MediaId=4616'
  const seen=[]
  const detail=`<html><head><meta content="Project Manager for development projects" property="og:title"></head><body>
    <div class="jix-toolbar-top__company">DEIF A/S</div><div class="PaidJob-inner"><h4>Project Manager for development projects</h4><p>Short teaser.</p></div>
    <a href="/c?t=e6266804&amp;ctx=w">Ansøg</a>
  </body></html>`
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss('h1001','Project Manager for development projects'))
    if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(detail)
    if(String(url)===tracker) return response('<html><body>Application form</body></html>',{url:applicationForm})
    if(String(url)===advertisement) return response(`<div id="AdvertisementInnerContent"><div class="AdContentContainer"><p>${body()}</p></div></div>`,{url:advertisement})
    throw new Error(`unexpected ${url}`)
  }
  const result=await runOne({fetcher})
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
  assert.match(result.jobs[0].fullJd,/enterprise project delivery/i)
  assert.ok(seen.includes(tracker))
  assert.ok(seen.includes(advertisement))
})

for(const fixture of [
  {
    name:'VIKING wrapper',
    wrapper:'https://www.viking-life.com/careers/vacancies/?hr=show-job/40110&linkref=3919&locale=da_DK',
    hrJs:'https://viking-life.hr-on.com/frame-api/hr.js',
    customerJs:'https://viking-life.hr-on.com/frame-api/customers/viking-regular-v2.js',
    root:'https://viking-life.hr-on.com/',companyId:'192',jobId:'40110',
  },
  {
    name:'VISUE wrapper',
    wrapper:'https://lindberghr.dk/stillinger/?hr=show-job%2F349477%26locale%3Dda_DK',
    hrJs:'https://hr-skyen.dk/hr/frame-api/hr.js',
    customerJs:'https://hr-skyen.dk/hr/frame-api/customers/lindberghr.js',
    root:'https://recruit.hr-on.com/',companyId:'291',jobId:'349477',
  },
]){
  test(`resolves embedded HR-ON full JD from ${fixture.name}`,async()=>{
    const frame=`${fixture.root}frame-api/pages/show-job/${fixture.jobId}?companyid=${fixture.companyId}&locale=da_DK`
    const seen=[]
    const fetcher=async url=>{
      seen.push(String(url))
      if(String(url).includes('jobsoegning.rss')) return response(rss('h1001','Project Manager'))
      if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(teaserDetail({id:'h1001',title:'Project Manager',applicationUrl:fixture.wrapper}))
      if(String(url)===fixture.wrapper) return response(`<html><script src="${fixture.hrJs}"></script><script src="${fixture.customerJs}"></script></html>`,{url:fixture.wrapper})
      if(String(url)===fixture.hrJs) return response(`var HR_WEB_ROOT = '${fixture.root}';`,{url:fixture.hrJs})
      if(String(url)===fixture.customerJs) return response(`new HRSkyen({ companyId: ${fixture.companyId}, locale: 'da_DK' });`,{url:fixture.customerJs})
      if(String(url)===frame) return response(`<div class="description"><p>${body()}</p></div>`,{url:frame})
      throw new Error(`unexpected ${url}`)
    }
    const result=await runOne({fetcher})
    assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
    assert.match(result.jobs[0].fullJd,/enterprise project delivery/i)
    assert.ok(seen.includes(frame))
  })
}

test('resolves DSV generic careers URL through exact-title search before reading the SuccessFactors JD',async()=>{
  const title='Senior Project Manager - join our Group Property Transaction team'
  const careers='https://www.dsv.com/da-dk/karriere'
  const direct='https://jobs.dsv.com/job/Hedehusene-Senior-Project-Manager-join-our-Group-Property-Transaction-team-84-2640/1429452533/'
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss('h1001',title))
    if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(teaserDetail({id:'h1001',title,applicationUrl:careers}))
    if(String(url)===careers) return response('<html><body>Careers landing page</body></html>',{url:careers})
    if(String(url).startsWith('https://jobs.dsv.com/search/?q=')) return response(`<a class="jobTitle-link" href="/job/Hedehusene-Senior-Project-Manager-join-our-Group-Property-Transaction-team-84-2640/1429452533/">${title}</a>`,{url:String(url)})
    if(String(url)===direct) return response(`<span itemprop="description"><span class="jobdescription"><p>${body()}</p></span></span>`,{url:direct})
    throw new Error(`unexpected ${url}`)
  }
  const result=await runOne({fetcher,role:'Project Manager'})
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
  assert.match(result.jobs[0].fullJd,/enterprise project delivery/i)
  assert.ok(seen.includes(direct))
})

test('extracts a substantive SuccessFactors joblayouttoken when itemprop description is absent',()=>{
  const html=`<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
    <div class="joblayouttoken"><span class="rtltextaligneligible">IT Service Delivery Manager</span></div>
    <div class="joblayouttoken"><div class="inner"><span class="rtltextaligneligible"><p>${body()}</p></span></div></div>
    <div class="joblayouttoken"><span class="rtltextaligneligible">Small footer token</span></div>
  </div>`
  const detail=extractJobindexExternalDetail(html,{url:'https://dsb.jobs.hr.cloud.sap/job/example/310-da_DK/'})
  assert.ok(detail.fullJd.length>700)
  assert.match(detail.fullJd,/enterprise project delivery/i)
  assert.doesNotMatch(detail.fullJd,/Small footer token/i)
})

test('resolves DSB generic careers URL through exact-title current-jobs data and reads the SuccessFactors JD',async()=>{
  const title='IT Service Delivery Manager med ansvar for leverandørstyring og stabile IT-services'
  const careers='https://www.dsb.dk/om-dsb/karriere-i-dsb/'
  const listing='https://www.dsb.dk/om-dsb/job-og-karriere/alle-ledige-stillinger-i-dsb/'
  const direct='https://dsb.jobs.hr.cloud.sap/job/H%C3%B8je-Taastrup-IT-Service-Delivery-Manager/310-da_DK/?feedId=453133&utm_source=LILimitedListings'
  const listingHtml=`<script>window.jobs=[{"title":${JSON.stringify(title)},"location":"Høje Taastrup","appliedUrl":"https://dsb.jobs.hr.cloud.sap/job/H%C3%B8je-Taastrup-IT-Service-Delivery-Manager/310-da_DK/?feedId=453133\\u0026utm_source=LILimitedListings"}]</script>`
  const directHtml=`<div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
    <div class="joblayouttoken"><span class="rtltextaligneligible">${title}</span></div>
    <div class="joblayouttoken"><div class="inner"><span class="rtltextaligneligible"><p>${body()}</p></span></div></div>
  </div>`
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss('h1001',title))
    if(String(url)==='https://www.jobindex.dk/vis-job/h1001') return response(teaserDetail({id:'h1001',title,applicationUrl:careers}))
    if(String(url)===careers) return response('<html><body>DSB careers landing page</body></html>',{url:careers})
    if(String(url)===listing) return response(listingHtml,{url:listing})
    if(String(url)===direct) return response(directHtml,{url:direct})
    throw new Error(`unexpected ${url}`)
  }
  const result=await runOne({fetcher,role:'Delivery Manager'})
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
  assert.match(result.jobs[0].fullJd,/enterprise project delivery/i)
  assert.ok(seen.includes(direct))
})
