import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function loadModule(){
  try{return await import('./night-flight-source-search.js')}catch(error){assert.fail(error?.stack||String(error))}
}

function linkedInSearchHtml(){
  const card=({id,title='Senior IT Project Manager',company='Acme',location='Copenhagen',date})=>`
    <li>
      <a href="https://www.linkedin.com/jobs/view/test-${id}/"></a>
      <h3 class="base-search-card__title">${title}</h3>
      <h4 class="base-search-card__subtitle">${company}</h4>
      <span class="job-search-card__location">${location}</span>
      <time datetime="${date}"></time>
    </li>`
  return [
    card({id:'1000001',date:'2026-10-09T12:00:00.000Z'}),
    card({id:'1000002',date:'2026-10-10T12:00:00.000Z'}),
    card({id:'1000003',date:'2026-10-10T22:30:00.000Z'}),
  ].join('')
}

function linkedInDetailHtml(id,date){
  const description=(`Senior IT Project Manager owns end to end IT technology project delivery, implementation, governance, stakeholders, risk, schedule and enterprise software integration. `).repeat(6)
  return `<script type="application/ld+json">${JSON.stringify({
    '@context':'https://schema.org','@type':'JobPosting',
    title:'Senior IT Project Manager',
    description,
    datePosted:date,
    hiringOrganization:{name:'Acme'},
    jobLocation:{address:{addressLocality:'Copenhagen',addressCountry:'Denmark'}},
  })}</script>`
}

test('Night Pilot discovery module is not wired to normal Search adapters or freshnessDays',async()=>{
  const source=await readFile(new URL('./night-flight-last-completed-day.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/linkedin-profile-search|linkedin-shadow-discovery|jobindex-source-adapter|jobnet-source-adapter|job-profile-evaluator/)
  assert.doesNotMatch(source,/freshnessDays|SOURCE_RETRIEVAL_DAYS/)
  assert.match(source,/night-flight-source-search/)
})

test('Night Pilot LinkedIn filters search cards to targetDate before any detail request',async()=>{
  const mod=await loadModule()
  const detailCalls=[]
  const fetcher=async url=>{
    const value=String(url)
    if(value.includes('seeMoreJobPostings/search')) return linkedInSearchHtml()
    const id=value.match(/jobPosting\/(\d+)/)?.[1]
    detailCalls.push(id)
    if(id==='1000002') return linkedInDetailHtml(id,'2026-10-10T12:00:00.000Z')
    throw new Error(`unexpected detail request for ${id}`)
  }
  const result=await mod.searchNightFlightLinkedIn({
    targetDate:'2026-10-10',
    now:new Date('2026-10-11T00:30:00.000Z'),
    discoverySearchPlan:{directions:[{key:'pm',role:'Senior IT Project Manager',query:'Senior IT Project Manager',tier:'primary',origin:'manual',cvSlots:[]}]},
    exclusionRules:[],
    fetcher,
  })
  assert.deepEqual(detailCalls,['1000002'])
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.sourceJobId,'1000002')
  assert.equal(mod.nightFlightCopenhagenDateKey(result.jobs[0].job.publishedAt),'2026-10-10')
})

test('Night Pilot LinkedIn transport envelope derives from target day start, not a Search freshness option',async()=>{
  const mod=await loadModule()
  const normal=mod.nightFlightLinkedInTransportSeconds({
    targetDate:'2026-10-10',
    now:new Date('2026-10-11T00:30:00.000Z'),
  })
  assert.ok(normal>=26*60*60,'02:30 Copenhagen run must cover the full previous local calendar day')
  const autumn=mod.nightFlightLinkedInTransportSeconds({
    targetDate:'2026-10-25',
    now:new Date('2026-10-26T01:30:00.000Z'),
  })
  assert.ok(autumn>=26.5*60*60,'DST autumn target day must not be truncated to a fixed 24-hour window')
})

test('Night Pilot exact date helper follows Copenhagen calendar boundaries',async()=>{
  const mod=await loadModule()
  assert.equal(mod.isNightFlightTargetDate('2026-10-09T22:00:00.000Z','2026-10-10'),true)
  assert.equal(mod.isNightFlightTargetDate('2026-10-10T21:59:59.999Z','2026-10-10'),true)
  assert.equal(mod.isNightFlightTargetDate('2026-10-10T22:00:00.000Z','2026-10-10'),false)
})
