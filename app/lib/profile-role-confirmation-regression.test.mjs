import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInProfile} from './linkedin-profile-search.js'

const card=(id,title)=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">Example Co</h4><span class="job-search-card__location">Copenhagen, Denmark</span><time datetime="2026-08-27"></time></li>`

function detail(title,description){
  const data={"@context":"https://schema.org","@type":"JobPosting",title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:'Example Co'},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

const plan={version:'union-search-plan-v1',directions:[{key:'technical program manager',role:'Technical Program Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}

test('Technical Program Manager keeps an AI-ready Data Foundation programme when Full JD confirms technology delivery',async()=>{
  const title='Programme Manager - AI-ready Data Foundation programme'
  const description='Lead a data foundation programme delivering a cloud data platform, enterprise integrations, governance, milestones, dependencies and technology outcomes. '.repeat(5)
  const fetcher=async url=>url.includes('/seeMoreJobPostings/search')?card('8300000001',title):detail(title,description)
  const result=await searchLinkedInProfile({freshnessDays:1,unionSearchPlan:plan,fetcher,now:new Date('2026-08-27T12:00:00Z')})
  assert.equal(result.jobs.length,1)
  assert.equal(result.jobs[0].job.title,title)
})
