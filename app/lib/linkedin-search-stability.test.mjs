import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routeUrl=new URL('../api/linkedin-search/route.js',import.meta.url)

function htmlResponse(status=200,headers={}){
  return new Response('<html><body>ok</body></html>',{status,headers:{'content-type':'text/html',...headers}})
}

test('LinkedIn search route allows the full five-minute Hobby Fluid Compute window',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/export const maxDuration\s*=\s*300\b/)
})

test('LinkedIn search route uses the stable fetcher for discovery and job details',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/createLinkedInStableFetcher/)
  assert.match(source,/const fetcher\s*=\s*createLinkedInStableFetcher\(\)/)
  assert.match(source,/searchLinkedIn\(\{freshnessDays,resume:cvText,fetcher\}\)/)
})

test('stable fetcher retries HTTP 429 and honors Retry-After before succeeding',async()=>{
  const {createLinkedInStableFetcher}=await import('./linkedin-stable-fetcher.js')
  let clock=0
  const waits=[]
  let calls=0
  const fetcher=createLinkedInStableFetcher({
    request:async()=>{
      calls++
      if(calls===1) return htmlResponse(429,{'retry-after':'2'})
      return htmlResponse(200)
    },
    maxConcurrency:1,
    minIntervalMs:0,
    maxAttempts:3,
    baseBackoffMs:100,
    totalBudgetMs:10000,
    now:()=>clock,
    sleep:async ms=>{ waits.push(ms); clock+=ms },
  })

  const html=await fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567890')
  assert.match(html,/ok/)
  assert.equal(calls,2)
  assert.deepEqual(waits,[2000])
})

test('stable fetcher does not retry non-retryable HTTP errors',async()=>{
  const {createLinkedInStableFetcher}=await import('./linkedin-stable-fetcher.js')
  let calls=0
  const fetcher=createLinkedInStableFetcher({
    request:async()=>{ calls++; return htmlResponse(404) },
    maxConcurrency:1,
    minIntervalMs:0,
    maxAttempts:5,
    now:()=>0,
    sleep:async()=>{},
  })
  await assert.rejects(()=>fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567890'),/LinkedIn HTTP 404/)
  assert.equal(calls,1)
})

test('stable fetcher limits concurrent LinkedIn requests',async()=>{
  const {createLinkedInStableFetcher}=await import('./linkedin-stable-fetcher.js')
  let active=0
  let peak=0
  const releases=[]
  const request=async()=>{
    active++
    peak=Math.max(peak,active)
    await new Promise(resolve=>releases.push(resolve))
    active--
    return htmlResponse(200)
  }
  const fetcher=createLinkedInStableFetcher({request,maxConcurrency:2,minIntervalMs:0,maxAttempts:1})
  const pending=[1,2,3,4].map(id=>fetcher(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/123456789${id}`))
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.equal(peak,2)
  releases.splice(0).forEach(resolve=>resolve())
  await new Promise(resolve=>setTimeout(resolve,0))
  releases.splice(0).forEach(resolve=>resolve())
  await Promise.all(pending)
  assert.equal(peak,2)
})

const TEST_RESUME=`Senior IT Project and Delivery Manager with enterprise software delivery, systems integration, governance, regulated financial IT, data platforms, Agile delivery, release and go-live experience across international technology teams.`

function searchHtmlFor(ids){
  return `<!doctype html><html><body><ul>${ids.map(id=>`<li><div class="base-card"><a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/technical-project-manager-${id}?trk=x"></a><h3 class="base-search-card__title">Technical Project Manager</h3><h4 class="base-search-card__subtitle">Example Company</h4><span class="job-search-card__location">Hørsholm, Capital Region of Denmark, Denmark</span><time datetime="2026-08-25"></time></div></li>`).join('')}</ul></body></html>`
}

function detailHtmlFor(id){
  const description=`Lead end-to-end software and enterprise IT delivery across engineering teams. Own scope, timelines, milestones, risks, dependencies, budget and delivery outcomes. Manage governance, senior stakeholders, systems integration, implementation, release readiness and go-live in an international Agile environment. `.repeat(3)
  const data={"@context":"https://schema.org","@type":"JobPosting",title:'Technical Project Manager',datePosted:'2026-08-25',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:`Example Company ${id}`},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Hørsholm',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

test('stable search returns every worthwhile match instead of silently capping results at ten',async()=>{
  const {searchLinkedInStable}=await import('./linkedin-stable-search.js')
  const ids=Array.from({length:30},(_,i)=>String(5550000000+i))
  const searchHtml=searchHtmlFor(ids)
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')) return searchHtml
    const id=url.match(/jobPosting\/(\d+)/)?.[1]
    return detailHtmlFor(id)
  }
  const result=await searchLinkedInStable({freshnessDays:3,resume:TEST_RESUME,fetcher,now:new Date('2026-08-25T12:00:00Z')})
  assert.equal(result.stats.discovered,30)
  assert.equal(result.stats.fullJdVerified,30)
  assert.equal(result.stats.returned,30)
  assert.equal(result.jobs.length,30)
  assert.equal(result.coverage.status,'SEARCHED')
})

test('stable search never labels a run complete when a job detail still failed',async()=>{
  const {searchLinkedInStable}=await import('./linkedin-stable-search.js')
  const ids=['6660000001','6660000002']
  const searchHtml=searchHtmlFor(ids)
  const fetcher=async url=>{
    if(url.includes('/seeMoreJobPostings/search')) return searchHtml
    if(url.endsWith('6660000002')) throw new Error('LinkedIn HTTP 429')
    return detailHtmlFor('6660000001')
  }
  const result=await searchLinkedInStable({freshnessDays:3,resume:TEST_RESUME,fetcher,now:new Date('2026-08-25T12:00:00Z')})
  assert.equal(result.coverage.status,'ACCESS LIMITED')
  assert.equal(result.diagnostics.detailFailures,1)
  assert.equal(result.stats.discovered,2)
  assert.equal(result.stats.fullJdVerified,1)
})
