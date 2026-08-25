import test from 'node:test'
import assert from 'node:assert/strict'
import { createLinkedInStableFetcher } from './linkedin-stable-fetcher.js'

function htmlResponse(status=200,headers={}){
  return new Response('<html><body>ok</body></html>',{status,headers:{'content-type':'text/html',...headers}})
}

test('default stable fetcher keeps retrying 429 beyond five attempts while budget remains',async()=>{
  let clock=0
  let calls=0
  const fetcher=createLinkedInStableFetcher({
    request:async()=>{
      calls++
      return calls<=6?htmlResponse(429):htmlResponse(200)
    },
    minIntervalMs:0,
    baseBackoffMs:10,
    maxBackoffMs:20,
    totalBudgetMs:1000,
    now:()=>clock,
    sleep:async ms=>{ clock+=ms },
  })

  const html=await fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567890')
  assert.match(html,/ok/)
  assert.equal(calls,7)
})

test('default LinkedIn pacing serializes requests to reduce rate-limit pressure',async()=>{
  let activeRequests=0
  let peak=0
  const request=async()=>{
    activeRequests++
    peak=Math.max(peak,activeRequests)
    await new Promise(resolve=>setTimeout(resolve,8))
    activeRequests--
    return htmlResponse(200)
  }
  const fetcher=createLinkedInStableFetcher({request,minIntervalMs:0,maxAttempts:1})
  await Promise.all([
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567891'),
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567892'),
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567893'),
  ])
  assert.equal(peak,1)
})

test('semaphore does not exceed its configured concurrency when a 429 retry races queued requests',async()=>{
  let activeRequests=0
  let peak=0
  let calls=0
  const request=async()=>{
    calls++
    if(calls===1) return htmlResponse(429)
    activeRequests++
    peak=Math.max(peak,activeRequests)
    await new Promise(resolve=>setTimeout(resolve,8))
    activeRequests--
    return htmlResponse(200)
  }
  let clock=0
  const fetcher=createLinkedInStableFetcher({
    request,
    maxConcurrency:1,
    minIntervalMs:0,
    maxAttempts:2,
    baseBackoffMs:1,
    maxBackoffMs:1,
    totalBudgetMs:1000,
    now:()=>clock,
    sleep:async ms=>{ clock+=ms },
  })
  await Promise.all([
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567894'),
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567895'),
  ])
  assert.equal(peak,1)
})

test('explicit Retry-After is honored before retrying',async()=>{
  let clock=0
  const waits=[]
  let calls=0
  const fetcher=createLinkedInStableFetcher({
    request:async()=>{
      calls++
      return calls===1?htmlResponse(429,{'retry-after':'2'}):htmlResponse(200)
    },
    maxConcurrency:1,
    minIntervalMs:0,
    maxAttempts:3,
    baseBackoffMs:100,
    maxBackoffMs:5000,
    totalBudgetMs:10000,
    now:()=>clock,
    sleep:async ms=>{ waits.push(ms); clock+=ms },
  })
  await fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567896')
  assert.equal(calls,2)
  assert.deepEqual(waits,[2000])
})

test('non-retryable LinkedIn errors still fail immediately',async()=>{
  let calls=0
  const fetcher=createLinkedInStableFetcher({
    request:async()=>{ calls++; return htmlResponse(404) },
    minIntervalMs:0,
    maxAttempts:20,
  })
  await assert.rejects(()=>fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567897'),/LinkedIn HTTP 404/)
  assert.equal(calls,1)
})

test('explicit concurrency greater than one is still respected exactly',async()=>{
  let activeRequests=0
  let peak=0
  const request=async()=>{
    activeRequests++
    peak=Math.max(peak,activeRequests)
    await new Promise(resolve=>setTimeout(resolve,8))
    activeRequests--
    return htmlResponse(200)
  }
  const fetcher=createLinkedInStableFetcher({request,maxConcurrency:2,minIntervalMs:0,maxAttempts:1})
  await Promise.all([
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567898'),
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567899'),
    fetcher('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567800'),
  ])
  assert.equal(peak,2)
})
