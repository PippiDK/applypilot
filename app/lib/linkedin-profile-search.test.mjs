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


test('role evaluation uses the full approved Search Profile, not only the discovery path',async()=>{
  const unionSearchPlan={version:'union-search-plan-v1',directions:[
    {key:'senior-it-project-manager',role:'Senior IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]},
    {key:'transformation-project-manager',role:'Transformation Project Manager',tier:'adjacent',origin:'cv',cvSlots:[1]},
  ]}
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')){
      const query=new URL(url).searchParams.get('keywords')
      return query==='Transformation Project Manager'
        ?card('8888888888','Senior IT Project Manager','Stable Co')
        :''
    }
    return detailHtml({
      title:'Senior IT Project Manager',
      company:'Stable Co',
      description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, timeline, risks, dependencies, governance and senior stakeholder delivery outcomes. '.repeat(5),
    })
  }
  const result=await searchLinkedInProfile({freshnessDays:7,unionSearchPlan,fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].evaluation.breakdown.roleDirection,'Senior IT Project Manager')
  assert.equal(result.jobs[0].evaluation.breakdown.tier,'primary')
})

test('same verified job and Search Profile keep the same role decision and score across different discovery paths',async()=>{
  const unionSearchPlan={version:'union-search-plan-v1',directions:[
    {key:'senior-it-project-manager',role:'Senior IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]},
    {key:'transformation-project-manager',role:'Transformation Project Manager',tier:'adjacent',origin:'cv',cvSlots:[1]},
  ]}
  const makeFetcher=visibleQuery=>async url=>{
    if(url.includes('/seeMoreJobPostings/search')){
      const query=new URL(url).searchParams.get('keywords')
      return query===visibleQuery
        ?card('9999999999','Senior IT Project Manager','Stable Co')
        :''
    }
    return detailHtml({
      title:'Senior IT Project Manager',
      company:'Stable Co',
      description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, timeline, risks, dependencies, governance and senior stakeholder delivery outcomes. '.repeat(5),
    })
  }
  const first=await searchLinkedInProfile({
    freshnessDays:7,
    unionSearchPlan,
    fetcher:makeFetcher('Senior IT Project Manager'),
    now:new Date('2026-08-27T12:00:00Z'),
  })
  const second=await searchLinkedInProfile({
    freshnessDays:7,
    unionSearchPlan,
    fetcher:makeFetcher('Transformation Project Manager'),
    now:new Date('2026-08-27T12:00:00Z'),
  })
  assert.equal(first.jobs.length,1)
  assert.equal(second.jobs.length,1)
  assert.equal(first.jobs[0].evaluation.breakdown.roleDirection,second.jobs[0].evaluation.breakdown.roleDirection)
  assert.equal(first.jobs[0].evaluation.breakdown.tier,second.jobs[0].evaluation.breakdown.tier)
  assert.equal(first.jobs[0].evaluation.score,second.jobs[0].evaluation.score)
  assert.equal(first.jobs[0].evaluation.verdict,second.jobs[0].evaluation.verdict)
})


test('all freshness views use the same 14-day LinkedIn discovery horizon',async()=>{
  const horizons=[]
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')){
      horizons.push(new URL(url).searchParams.get('f_TPR'))
      return card('1212121212','Senior IT Project Manager','Stable Co')
    }
    return detailHtml({
      title:'Senior IT Project Manager',
      company:'Stable Co',
      description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, timeline, risks, dependencies and governance. '.repeat(5)
    })
  }
  const searchPlan=plan('Senior IT Project Manager')
  await searchLinkedInProfile({freshnessDays:1,unionSearchPlan:searchPlan,fetcher,now:new Date('2026-08-27T12:00:00Z')})
  await searchLinkedInProfile({freshnessDays:7,unionSearchPlan:searchPlan,fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.ok(horizons.length>=2)
  assert.deepEqual([...new Set(horizons)],['r1209600'])
})

test('1/3/7/14-day views are local subsets over the same discovered jobs',async()=>{
  const datedDetail=(title,company,datePosted)=>detailHtml({
    title,
    company,
    description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, timeline, risks, dependencies and governance. '.repeat(5)
  }).replace('"datePosted":"2026-08-27"',`"datePosted":"${datePosted}"`)

  const searchHtml=[
    card('1313131313','Senior IT Project Manager','Today Co'),
    card('1414141414','Senior IT Project Manager','Three Day Co'),
    card('1515151515','Senior IT Project Manager','Seven Day Co'),
    card('1616161616','Senior IT Project Manager','Fourteen Day Co')
  ].join('')

  const details={
    '1313131313':datedDetail('Senior IT Project Manager','Today Co','2026-08-27'),
    '1414141414':datedDetail('Senior IT Project Manager','Three Day Co','2026-08-25'),
    '1515151515':datedDetail('Senior IT Project Manager','Seven Day Co','2026-08-22'),
    '1616161616':datedDetail('Senior IT Project Manager','Fourteen Day Co','2026-08-15')
  }

  const fetcher=scenarioFetcher({searchHtml,details})
  const searchPlan=plan('Senior IT Project Manager')
  const run=days=>searchLinkedInProfile({freshnessDays:days,unionSearchPlan:searchPlan,fetcher,now:new Date('2026-08-27T12:00:00Z')})
  const [one,three,seven,fourteen]=await Promise.all([run(1),run(3),run(7),run(14)])
  const companies=result=>result.jobs.map(item=>item.job.company).sort()

  assert.deepEqual(companies(one),['Today Co'])
  assert.deepEqual(companies(three),['Three Day Co','Today Co'])
  assert.deepEqual(companies(seven),['Seven Day Co','Three Day Co','Today Co'])
  assert.deepEqual(companies(fourteen),['Fourteen Day Co','Seven Day Co','Three Day Co','Today Co'])
})


test('previous in-window candidate remains in the 14-day master pool when LinkedIn omits it on refresh',async()=>{
  const previous=[{
    jobId:'1717171717',
    url:'https://www.linkedin.com/jobs/view/1717171717/',
    title:'Senior IT Project Manager',
    company:'Remembered Co',
    location:'Copenhagen',
    publishedAt:'2026-08-25',
    foundBy:[]
  }]
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')) return ''
    return detailHtml({
      title:'Senior IT Project Manager',
      company:'Remembered Co',
      description:'Lead enterprise IT projects from planning through implementation and go-live. Own scope, timeline, risks, dependencies and governance. '.repeat(5)
    }).replace('"datePosted":"2026-08-27"','"datePosted":"2026-08-25"')
  }
  const result=await searchLinkedInProfile({
    freshnessDays:7,
    unionSearchPlan:plan('Senior IT Project Manager'),
    previousCandidates:previous,
    fetcher,
    now:new Date('2026-08-27T12:00:00Z')
  })
  assert.equal(result.masterCandidates.length,1)
  assert.equal(result.masterCandidates[0].jobId,'1717171717')
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.company,'Remembered Co')
  assert.equal(result.stats.masterPoolSize,1)
})

test('master pool drops a previous candidate once its known posting date is outside 14 days',async()=>{
  let detailRequests=0
  const previous=[{
    jobId:'1818181818',
    url:'https://www.linkedin.com/jobs/view/1818181818/',
    title:'Senior IT Project Manager',
    company:'Expired Co',
    location:'Copenhagen',
    publishedAt:'2026-08-01',
    foundBy:[]
  }]
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')) return ''
    detailRequests++
    return detailHtml({title:'Senior IT Project Manager',company:'Expired Co'})
  }
  const result=await searchLinkedInProfile({
    freshnessDays:14,
    unionSearchPlan:plan('Senior IT Project Manager'),
    previousCandidates:previous,
    fetcher,
    now:new Date('2026-08-27T12:00:00Z')
  })
  assert.deepEqual(result.masterCandidates,[])
  assert.equal(result.jobs.length,0)
  assert.equal(detailRequests,0)
})
