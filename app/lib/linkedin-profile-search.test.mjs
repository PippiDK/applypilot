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

test('existing IT Project Manager profile still keeps a credible PM baseline vacancy and writes a 0-100 audit percentage',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('4444444444','Senior IT Project Manager','Ambu'),
    details:{'4444444444':detailHtml({title:'Senior IT Project Manager',company:'Ambu',description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, risks, dependencies, stakeholders and delivery outcomes. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.company,'Ambu')
  assert.ok(result.jobs[0].evaluation.score>=7.5)
  const kept=result.audit.find(row=>row.jobId==='4444444444'&&row.decision==='KEEP')
  assert.ok(kept.score>10&&kept.score<=100)
})

test('IT Project Manager direction rejects a finance project role when the full JD has no technology delivery evidence',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000001','Senior Finance Project Manager'),
    details:{'8100000001':detailHtml({title:'Senior Finance Project Manager',description:'Lead budgeting, forecasting, financial controls, month-end reporting, cost governance and finance stakeholder coordination. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,0)
  assert.ok(result.audit.some(row=>row.jobId==='8100000001'&&row.stage==='PROFILE_DOMAIN_REJECT'))
})

test('IT Project Manager direction rejects a construction project role when the full JD confirms physical construction delivery',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000002','Project and Construction Manager'),
    details:{'8100000002':detailHtml({title:'Project and Construction Manager',description:'Manage construction sites, contractors, building permits, fit-out schedules, civil works, handover and physical store openings. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,0)
  assert.ok(result.audit.some(row=>row.jobId==='8100000002'&&row.stage==='PROFILE_DOMAIN_REJECT'))
})

test('IT Program Manager direction rejects an IT Product Manager whose JD is product ownership rather than program delivery',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000003','IT Product Manager - Manufacturing'),
    details:{'8100000003':detailHtml({title:'IT Product Manager - Manufacturing',description:'Own the product vision, product roadmap, backlog prioritisation, user discovery, feature adoption and product lifecycle for a manufacturing application. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('IT Program Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,0)
  assert.ok(result.audit.some(row=>row.jobId==='8100000003'&&row.stage==='PROFILE_ROLE_FAMILY_REJECT'))
})

test('manager-level transformation direction rejects an explicit Head-of-division vacancy',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000004','Head of Lending Technology & Applications Division'),
    details:{'8100000004':detailHtml({title:'Head of Lending Technology & Applications Division',description:'Lead a technology division, own organisation design, people leadership, management layers and a multi-year technology transformation agenda. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Technology Transformation Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,0)
  assert.ok(result.audit.some(row=>row.jobId==='8100000004'&&row.stage==='PROFILE_ROLE_FAMILY_REJECT'))
})

test('IT Project Manager direction keeps an atypical eCOA title when the full JD confirms digital system delivery',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000005','eCOA Project Manager'),
    details:{'8100000005':detailHtml({title:'eCOA Project Manager',description:'Lead implementation of an electronic clinical outcome assessment platform, coordinate software configuration, system integrations, validation, release readiness and go-live across client teams. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
})

test('IT Project Manager direction keeps an atypical SCADA and OT security project title when the full JD confirms technology delivery',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8100000006','Senior SCADA & OT Security Package/Project Manager'),
    details:{'8100000006':detailHtml({title:'Senior SCADA & OT Security Package/Project Manager',description:'Lead delivery of SCADA and OT cybersecurity systems, coordinate software and controls integration, technology suppliers, testing, deployment, risks and technical stakeholders. '.repeat(5)})}
  })
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Senior IT Project Manager'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
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

test('worthwhile evaluated stat counts only kept matches while evaluatedCandidates tracks reviewed JDs',async()=>{
  const fetcher=scenarioFetcher({
    searchHtml:card('8200000001','Software Developer')+card('8200000002','Senior Project Manager'),
    details:{
      '8200000001':detailHtml({title:'Software Developer',description:'Develop, test and maintain production software and APIs. '.repeat(8)}),
      '8200000002':detailHtml({title:'Senior Project Manager',description:'Own budgets, schedules and steering committees for business projects. '.repeat(8)})
    }
  })
  const result=await searchLinkedInProfile({freshnessDays:1,unionSearchPlan:plan('Software Developer'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.stats.evaluatedCandidates,2)
  assert.equal(result.stats.evaluated,1)
  assert.equal(result.stats.returned,1)
})

test('7-day profile discovery uses repeated deep LinkedIn pages instead of shadow start=0 only',async()=>{
  const searchStarts=[]
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')){
      searchStarts.push(Number(new URL(url).searchParams.get('start')))
      return card('7777777777','Software Developer')
    }
    return detailHtml({title:'Software Developer',description:'Develop, test and maintain production software and APIs for customer-facing services. '.repeat(8)})
  }
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:plan('Software Developer'),fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.ok(searchStarts.includes(25))
  assert.ok(searchStarts.includes(50))
  assert.ok(searchStarts.filter(start=>start===0).length>=2)
  assert.ok(Array.isArray(result.stats.discoveryPasses))
  assert.equal(result.jobs.length,1)
})
