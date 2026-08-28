import test from 'node:test'
import assert from 'node:assert/strict'
import {searchLinkedInProfile} from './linkedin-profile-search.js'

const card=(id,title,publishedAt)=>`<li><div class="base-card"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">${title}</h3><h4 class="base-search-card__subtitle">Example Co</h4><span class="job-search-card__location">Copenhagen, Denmark</span><time datetime="${publishedAt}"></time></div></li>`

function detailHtml({title,publishedAt}){
  const description='Lead enterprise IT projects from planning through implementation and go-live. Own scope, risks, dependencies, stakeholders and delivery outcomes. '.repeat(5)
  const data={"@context":"https://schema.org","@type":"JobPosting",title,datePosted:publishedAt,validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:'Example Co'},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

const plan={version:'union-search-plan-v1',directions:[{key:'senior it project manager',role:'Senior IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}

test('1 day means the current Denmark calendar day from 00:00, not yesterday',async()=>{
  const yesterday='2026-08-27T23:59:00+02:00'
  const today='2026-08-28T00:00:00+02:00'
  const searchHtml=card('1111111111','Senior IT Project Manager',yesterday)+card('2222222222','Senior IT Project Manager',today)
  const details={
    '1111111111':detailHtml({title:'Senior IT Project Manager',publishedAt:yesterday}),
    '2222222222':detailHtml({title:'Senior IT Project Manager',publishedAt:today}),
  }
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')) return searchHtml
    return details[url.split('/').pop()]
  }

  const result=await searchLinkedInProfile({freshnessDays:1,unionSearchPlan:plan,fetcher,now:new Date('2026-08-28T00:30:00+02:00')})

  assert.equal(result.jobs.length,1)
  assert.ok(result.audit.some(row=>row.jobId==='1111111111'&&row.stage==='FRESHNESS_REJECT'))
  assert.ok(result.audit.some(row=>row.jobId==='2222222222'&&row.stage==='KEPT'))
})
