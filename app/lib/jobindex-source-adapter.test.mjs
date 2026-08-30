import test from 'node:test'
import assert from 'node:assert/strict'
import { searchJobindexSource } from './jobindex-source-adapter.js'

function response(body,status=200){return {ok:status>=200&&status<300,status,text:async()=>body}}
function rss(items=[]){return `<?xml version="1.0"?><rss><channel>${items.map(({id,title,description=''})=>`<item><title>${title}</title><link>https://www.jobindex.dk/vis-job/${id}</link><description><![CDATA[<p>${description}</p>]]></description></item>`).join('')}</channel></rss>`}

const SEARCH_PAGE_1='<a href="/vis-job/h1001">one</a><a href="/vis-job/h1002">two</a>'
const SEARCH_PAGE_2='<a href="/vis-job/h1002">two</a><a href="/vis-job/h1003">three</a>'
const EMPTY_PAGE='<html><body>No jobs</body></html>'

function detail(id,{title='Senior Project Manager',company='Acme A/S',location='Copenhagen, Denmark',date='2026-08-30'}={}){
  return `<script type="application/ld+json">${JSON.stringify({
    '@type':'JobPosting',
    title,
    hiringOrganization:{name:company},
    jobLocation:{address:{addressLocality:location}},
    datePosted:date,
    description:`Lead project delivery for ${id}. Own scope, risks, dependencies, stakeholders and implementation outcomes across complex technology change. `.repeat(8),
    url:`https://www.jobindex.dk/vis-job/${id}`,
  })}</script>`
}

function currentJobindexDetail({id='h1001',title='Senior Delivery Manager',company='Acme A/S',location='Copenhagen',external='https://acme.example/jobs/42'}={}){
  return `<html><head><meta content="${title}" property="og:title"></head><body>
    <div class="jix-toolbar-top__company"><a href="https://recruiter.example">Recruiter ApS</a> søger for ${company}</div>
    <div class="PaidJob-inner"><h4><a href="${external}">${title}</a></h4><div class="jobad-element-area"><span class="jix_robotjob--area">${location}</span></div><p>Short Jobindex teaser only.</p></div>
    <div class="jix_toolbar jix_appetizer_toolbar"><div class="jix-toolbar__pubdate"><time datetime="2026-08-30">30-08-2026</time></div></div>
  </body></html>`
}

function externalFullJd(){
  const body='Lead end-to-end delivery, scope, risks, dependencies and senior stakeholders across complex enterprise technology change. '.repeat(12)
  return `<html><body><section class="full-detail-description full-detail"><div><h2>Job description</h2><p>${body}</p></div></section></body></html>`
}

function oraclePayload(){
  const body='<p>'+ 'Lead enterprise project delivery across scope, risks, dependencies and senior stakeholders. '.repeat(12)+'</p>'
  return JSON.stringify({items:[{
    Id:'8022',Title:'Senior Project Manager',LegalEmployer:'Acme A/S',PrimaryLocation:'Kongens Lyngby',PrimaryLocationCountry:'DK',WorkplaceType:'Hybrid',ExternalPostedStartDate:'2026-08-30T08:00:00+00:00',ExternalDescriptionStr:body,
  }]})
}

test('uses exact-phrase Jobindex RSS query and rejects obviously unrelated RSS titles before detail fetch',async()=>{
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss([
      {id:'h1001',title:'R&amp;D Chef - BRIGHT',description:'Research role'},
      {id:'h1002',title:'Technical Project Manager, Acme A/S',description:'Technology delivery role'},
    ]))
    if(String(url).includes('/vis-job/h1002')) return response(detail('h1002',{title:'Technical Project Manager'}))
    throw new Error(`unexpected detail fetch ${url}`)
  }
  const result=await searchJobindexSource({
    unionSearchPlan:{directions:[{role:'Senior Project Manager',tier:'primary',query:'Project Manager'}]},
    fetcher,
    maxPages:1,
  })
  assert.match(seen[0],/\/jobsoegning\.rss\?q=%22Project\+Manager%22/)
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].sourceJobId,'h1002')
  assert.equal(result.stats.detailRequests,1)
  assert.equal(result.stats.discoveryTitleRejected,1)
  assert.ok(!seen.some(url=>url.includes('/vis-job/h1001')))
})

test('paginates Jobindex, accumulates unique ids and preserves discovery direction',async()=>{
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('/vis-job/h1001')) return response(detail('h1001'))
    if(String(url).includes('/vis-job/h1002')) return response(detail('h1002'))
    if(String(url).includes('/vis-job/h1003')) return response(detail('h1003'))
    if(String(url).includes('page=3')) return response(EMPTY_PAGE)
    if(String(url).includes('page=2')) return response(SEARCH_PAGE_2)
    return response(SEARCH_PAGE_1)
  }
  const result=await searchJobindexSource({
    freshnessDays:7,
    unionSearchPlan:{directions:[{role:'Senior Project Manager',tier:'primary',query:'Project Manager'}]},
    exclusionRules:[],
    filters:{},
    fetcher,
    maxPages:3,
  })
  assert.equal(result.status,'success')
  assert.equal(result.jobs.length,3)
  assert.deepEqual(result.jobs[0].foundBy,[{role:'Senior Project Manager',tier:'primary',query:'Project Manager'}])
  assert.ok(seen.some(url=>url.includes('page=2')))
  assert.ok(seen.some(url=>url.includes('/vis-job/h1003')))
})

test('fetches external employer page when current Jobindex detail only has a teaser',async()=>{
  const seen=[]
  const fetcher=async url=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response('<a href="/vis-job/h1001">one</a>')
    if(String(url).includes('/vis-job/h1001')) return response(currentJobindexDetail())
    if(String(url)==='https://acme.example/jobs/42') return response(externalFullJd())
    throw new Error(`unexpected ${url}`)
  }
  const result=await searchJobindexSource({
    unionSearchPlan:{directions:[{role:'Senior Delivery Manager',tier:'primary'}]},
    fetcher,
    maxPages:1,
  })
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].title,'Senior Delivery Manager')
  assert.equal(result.jobs[0].company,'Acme A/S')
  assert.equal(result.jobs[0].location,'Copenhagen')
  assert.match(result.jobs[0].fullJd,/end-to-end delivery/i)
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
  assert.equal(result.stats.externalDetailRequests,1)
  assert.equal(result.stats.fullJdVerified,1)
  assert.ok(seen.includes('https://acme.example/jobs/42'))
})

test('uses Oracle CandidateExperience API when the public application page is only a shell',async()=>{
  const seen=[]
  const oracleUrl='https://tenant.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/da/sites/CX_1/job/8022'
  const fetcher=async (url,options)=>{
    seen.push(String(url))
    if(String(url).includes('jobsoegning.rss')) return response(rss([{id:'h8022',title:'Senior Project Manager',description:'Technology project role'}]))
    if(String(url).includes('/vis-job/h8022')) return response(currentJobindexDetail({id:'h8022',title:'Senior Project Manager',company:'Acme A/S',location:'Kongens Lyngby',external:oracleUrl}))
    if(String(url)===oracleUrl) return response('<html><body><div id="app">Candidate Experience</div></body></html>')
    if(String(url).includes('/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails')){
      assert.equal(options?.headers?.Accept,'application/json')
      assert.equal(options?.headers?.['Ora-Irc-Language'],'da')
      return response(oraclePayload())
    }
    throw new Error(`unexpected ${url}`)
  }
  const result=await searchJobindexSource({
    unionSearchPlan:{directions:[{role:'Senior Project Manager',tier:'primary',query:'Project Manager'}]},
    fetcher,
    maxPages:1,
  })
  const apiUrl=seen.find(url=>url.includes('recruitingCEJobRequisitionDetails'))
  assert.ok(apiUrl)
  assert.equal(new URL(apiUrl).searchParams.get('finder'),'ById;Id="8022",siteNumber=CX_1')
  assert.match(result.jobs[0].fullJd,/enterprise project delivery/i)
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,false)
  assert.equal(result.stats.externalParseMisses,1)
  assert.equal(result.stats.oracleDetailRequests,1)
  assert.equal(result.stats.oracleDetailVerified,1)
  assert.equal(result.stats.oracleDetailFailures,0)
  assert.equal(result.stats.externalDetailFailures,0)
  assert.equal(result.stats.fullJdVerified,1)
})

test('keeps basic Jobindex vacancy as limited when external full JD cannot be verified',async()=>{
  const fetcher=async url=>{
    if(String(url).includes('jobsoegning.rss')) return response('<a href="/vis-job/h1001">one</a>')
    if(String(url).includes('/vis-job/h1001')) return response(currentJobindexDetail())
    if(String(url)==='https://acme.example/jobs/42') return response('<html><body><p>Employer home page only.</p></body></html>')
    throw new Error(`unexpected ${url}`)
  }
  const result=await searchJobindexSource({
    unionSearchPlan:{directions:[{role:'Senior Delivery Manager',tier:'primary'}]},
    fetcher,
    maxPages:1,
  })
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].title,'Senior Delivery Manager')
  assert.equal(result.jobs[0].company,'Acme A/S')
  assert.equal(result.jobs[0].fullJd,'')
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,true)
  assert.equal(result.stats.externalDetailRequests,1)
  assert.equal(result.stats.externalFetchFailures,0)
  assert.equal(result.stats.externalParseMisses,1)
  assert.equal(result.stats.externalDetailFailures,1)
  assert.equal(result.stats.fullJdVerified,0)
  assert.equal(result.status,'partial')
})

test('retains limited-data record when one detail request fails',async()=>{
  const fetcher=async url=>{
    if(String(url).includes('/vis-job/h1001')) throw new Error('detail down')
    if(String(url).includes('page=2')) return response(EMPTY_PAGE)
    return response('<a href="/vis-job/h1001">one</a>')
  }
  const result=await searchJobindexSource({
    unionSearchPlan:{directions:[{role:'Delivery Manager',tier:'primary'}]},
    fetcher,
    maxPages:2,
  })
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].sourceJobId,'h1001')
  assert.equal(result.jobs[0].fullJd,'')
  assert.equal(result.jobs[0].sourceRecords[0].limitedData,true)
  assert.equal(result.status,'partial')
})

test('fails safely when Search Profile has no directions',async()=>{
  const result=await searchJobindexSource({unionSearchPlan:{directions:[]},fetcher:async()=>response('')})
  assert.equal(result.status,'failed')
  assert.match(result.error,/Search Profile/i)
})
