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

test('Software Developer profile keeps a Software Engineer vacancy and rejects an unrelated PM returned by LinkedIn',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('1111111111','Senior Software Engineer')+card('2222222222','Senior Project Manager'),
    details:{
      '1111111111':detailHtml({title:'Senior Software Engineer',description:'Build and maintain production software, APIs and cloud services. Design, code, test and review software with an engineering team. '.repeat(5)}),
      '2222222222':detailHtml({title:'Senior Project Manager',description:'Own project governance, budgets, milestones, steering committees and delivery plans. '.repeat(5)})
    }
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Software Developer'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.deepEqual(result.jobs.map(item=>item.job.title),['Senior Software Engineer'])
  assert.ok(result.jobs[0].evaluation.score>=6)
  assert.ok(result.audit.some(row=>row.jobId==='2222222222'&&row.decision==='REJECT'))
})

test('QA/Test profile recognizes Test Manager as the same professional direction',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('3333333333','Test Manager'),
    details:{'3333333333':detailHtml({title:'Test Manager',description:'Lead software testing, quality assurance, test strategy, regression testing and release quality across digital products. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('QA Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.title,'Test Manager')
  assert.ok(result.jobs[0].evaluation.score>=6)
})

test('existing IT Project Manager profile still keeps a credible PM baseline vacancy',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('4444444444','Senior IT Project Manager','Ambu'),
    details:{'4444444444':detailHtml({title:'Senior IT Project Manager',company:'Ambu',description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, risks, dependencies, stakeholders and delivery outcomes. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.company,'Ambu')
  assert.ok(result.jobs[0].evaluation.score>=7.5)
})

test('deterministic company exclusion rejects an otherwise relevant profile match',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('5555555555','Software Developer','NoGo Corp'),
    details:{'5555555555':detailHtml({title:'Software Developer',company:'NoGo Corp',description:'Develop, test and maintain production software and APIs. '.repeat(8)})}
  })
  const exclusionRules=[{category:'company',operator:'exclude',value:'NoGo Corp',unit:'',evaluation:'deterministic',originalText:'No NoGo Corp'}]
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Software Developer'),exclusionRules,fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,0)
  assert.ok(result.audit.some(row=>row.jobId==='5555555555'&&row.stage==='PROFILE_EXCLUSION_REJECT'))
})

test('profile-driven search returns legacy-compatible result shape and full-JD statistics',async()=>{
  const fetcher=scenarioFetcher({searchHtml:card('6666666666','Software Developer'),details:{'6666666666':detailHtml({title:'Software Developer'})}})
  const result=await searchLinkedInProfile({freshnessDays:1,unionSearchPlan:plan('Software Developer'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.stats.discovered,1)
  assert.equal(result.stats.fullJdVerified,1)
  assert.equal(result.stats.evaluated,1)
  assert.equal(result.stats.returned,1)
  assert.equal(result.coverage.source,'LinkedIn Jobs')
  assert.ok(Array.isArray(result.audit))
  assert.equal(result.jobs[0].job.fullJdVerified,true)
})
