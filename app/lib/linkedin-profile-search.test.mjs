import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInProfile} from './linkedin-profile-search.js'

const card=(id,title,company='Example Co')=>`<li><div class="base-card"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">${company}</h4><span class="job-search-card__location">Copenhagen, Denmark</span><time datetime="2026-08-27"></time></div></li>`

function detailHtml({title,company='Example Co',description}={}){
  const desc=description||`${title}. Own the responsibilities expected for this professional role, collaborate with stakeholders and deliver measurable outcomes. `.repeat(5)
  const data={"@context":"https://schema.org","@type":"JobPosting",title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:company},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description:desc}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${desc}</div></body></html>`
}

const plan=role=>({version:'union-search-plan-v1',directions:[{key:role.toLowerCase(),role,tier:'primary',origin:'cv',cvSlots:[1]}]})

function scenarioFetcher({searchHtml,details}){
  return async url=>{
    if(url.includes('/seeMoreJobPostings/search')) return searchHtml
    const id=url.split('/').pop()
    return details[id]
  }
}

test('legacy profile search keeps semantic match and preserves public result shape',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('6666666666','Software Engineer'),
    details:{'6666666666':detailHtml({title:'Software Engineer',description:'Build production software APIs and cloud services with an engineering team. '.repeat(8)})}
  })
  const modelCall=async args=>({results:args.input.items.map(item=>({
    jobId:item.jobId,
    compatible:true,
    directionKey:item.directions[0].key,
    score:85,
    reason:'semantic match'
  }))})
  const result=await searchLinkedInProfile({freshnessDays:1,unionSearchPlan:plan('Software Developer'),fetcher,modelCall,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].evaluation.breakdown.semanticCompatibility,85)
  assert.ok(result.audit.some(row=>row.jobId==='6666666666'&&row.stage==='KEPT'))
  assert.equal(result.stats.discovered,1)
  assert.equal(result.stats.fullJdVerified,1)
  assert.equal(result.stats.evaluated,1)
  assert.equal(result.stats.returned,1)
  assert.equal(result.coverage.source,'LinkedIn Jobs')
  assert.ok(Array.isArray(result.audit))
})

test('legacy profile search rejects title overlap when semantic JD meaning is different',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000002','Senior Project Manager'),
    details:{'8100000002':detailHtml({title:'Senior Project Manager',description:'Lead highway construction, civil contractors, site works and road infrastructure delivery. '.repeat(6)})}
  })
  const modelCall=async args=>({results:args.input.items.map(item=>({
    jobId:item.jobId,
    compatible:false,
    directionKey:'',
    score:18,
    reason:'Civil construction work is materially different.'
  }))})
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,modelCall,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,0)
  assert.ok(result.audit.some(row=>row.jobId==='8100000002'&&row.stage==='PROFILE_ROLE_REJECT'&&row.decision==='REJECT'))
})
