import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInProfile} from './linkedin-profile-search.js'

const card=(id,title)=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">Example Co</h4><span class="job-search-card__location">Copenhagen, Denmark</span><time datetime="2026-08-27"></time></li>`

function detail(title,description){
  const data={"@context":"https://schema.org","@type":"JobPosting",title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:'Example Co'},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

const technicalProgramPlan={version:'union-search-plan-v1',directions:[{key:'technical program manager',role:'Technical Program Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}
const itProjectPlan={version:'union-search-plan-v1',directions:[{key:'it project manager',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}

async function runCase({id,title,description,plan=itProjectPlan}){
  const fetcher=async url=>url.includes('/seeMoreJobPostings/search')?card(id,title):detail(title,description)
  return searchLinkedInProfile({freshnessDays:1,unionSearchPlan:plan,fetcher,now:new Date('2026-08-27T12:00:00Z')})
}

test('Technical Program Manager keeps an AI-ready Data Foundation programme when Full JD confirms technology delivery',async()=>{
  const title='Programme Manager - AI-ready Data Foundation programme'
  const description='Lead a data foundation programme delivering a cloud data platform, enterprise integrations, governance, milestones, dependencies and technology outcomes. '.repeat(5)
  const result=await runCase({id:'8300000001',title,description,plan:technicalProgramPlan})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.title,title)
})

test('Atea Danish Senior IT-projektleder is kept for IT Project Manager direction',async()=>{
  const title='Senior IT-projektledere med teknisk indsigt'
  const description='Atea søger senior IT-projektledere til komplekse kundeinitiativer og større IT-leverancer. Du leder tekniske projektteams, styrer projektledelse, afhængigheder, milepæle og leverancer på tværs af IT-systemer og platforme. '.repeat(4)
  const result=await runCase({id:'8300000002',title,description})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.title,title)
})

test('PET Danish strategic IT project role is kept for IT Project Manager direction',async()=>{
  const title='Kan du drive succesfulde strategiske IT projekter i PET?'
  const description='Som vores nye IT-projektleder driver du komplekse strategiske IT-projekter. Du har erfaring med IT-projektledelse og Scrum Master-arbejde og skaber fremdrift, koordinering og leverancer mellem tekniske teams og forretningen. '.repeat(4)
  const result=await runCase({id:'8300000003',title,description})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.title,title)
})

test('Regionshospitalet Danish digitalisation project manager is kept for IT Project Manager direction',async()=>{
  const title='Erfaren projektleder søges til kliniknær digitalisering'
  const description='Du driver kliniknære digitaliseringsprojekter og implementering af digitale løsninger. Rollen koordinerer projektledelse, IT-systemer, integrationer, leverancer, interessenter og organisatorisk implementering på tværs af hospitalet. '.repeat(4)
  const result=await runCase({id:'8300000004',title,description})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.title,title)
})

test('Energinet physical green-transition investment project stays rejected for IT Project Manager direction',async()=>{
  const title='Projektleder til investeringsprojekter i den grønne omstilling'
  const description='Du driver investeringsprojekter i den grønne omstilling med fokus på elnet, anlægsprojekter, myndighedsprocesser, entreprenører, økonomi, kvalitet og fremdrift fra planlægning til fysisk udførelse. '.repeat(4)
  const result=await runCase({id:'8300000005',title,description})
  assert.equal(result.jobs.length,0)
  assert.equal(result.audit.some(row=>row.jobId==='8300000005'&&row.stage==='PROFILE_ROLE_REJECT'),true)
})
