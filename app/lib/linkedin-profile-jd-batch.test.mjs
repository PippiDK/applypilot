import test from 'node:test'
import assert from 'node:assert/strict'
import {runProfileJdBatch} from './linkedin-profile-jd-batch.js'

const direction={key:'it project manager',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}
const candidates=Array.from({length:35},(_,i)=>({jobId:String(9100000000+i),title:`IT Project Manager ${i+1}`,company:'Example Co',location:'Denmark',publishedAt:'2026-08-27',foundBy:[direction]}))

function detail(candidate){
  const description='Lead IT projects delivering software platforms, integrations, milestones, dependencies and technical outcomes across teams. '.repeat(5)
  const data={"@context":"https://schema.org","@type":"JobPosting",title:candidate.title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:candidate.company},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

function genericDetail(candidate){
  const description='Lead complex cross-functional initiatives, stakeholders, plans, risks, milestones, dependencies and delivery. '.repeat(5)
  const data={"@context":"https://schema.org","@type":"JobPosting",title:candidate.title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:candidate.company},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

test('candidate 31+ is preserved for a later invocation when max batch is 30',async()=>{
  const fetcher=async url=>detail(candidates.find(row=>url.endsWith(row.jobId)))
  const first=await runProfileJdBatch({candidates,fetcher,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:999999,clock:()=>0})
  assert.equal(first.processed.length,30)
  assert.equal(first.remaining.length,5)
  assert.equal(first.remaining[0].jobId,candidates[30].jobId)
  const second=await runProfileJdBatch({candidates:first.remaining,fetcher,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:999999,clock:()=>0})
  assert.equal(second.processed.length,5)
  assert.equal(second.remaining.length,0)
  assert.equal(first.jobs.length+second.jobs.length,35)
})

test('safe time budget stops early without classifying untouched candidates as failures',async()=>{
  let tick=0
  const clock=()=>tick
  const fetcher=async url=>{ tick+=40; return detail(candidates.find(row=>url.endsWith(row.jobId))) }
  const result=await runProfileJdBatch({candidates:candidates.slice(0,10),fetcher,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:100,clock})
  assert.equal(result.processed.length>0,true)
  assert.equal(result.processed.length<10,true)
  assert.equal(result.remaining.length,10-result.processed.length)
  assert.equal(result.accessLimited,false)
})

test('one inaccessible JD is UNVERIFIED but later candidates still process',async()=>{
  const subset=candidates.slice(0,4)
  const fetcher=async url=>{
    if(url.endsWith(subset[1].jobId)) throw new Error('LinkedIn public page returned an access wall/challenge')
    return detail(subset.find(row=>url.endsWith(row.jobId)))
  }
  const result=await runProfileJdBatch({candidates:subset,fetcher,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:999999,clock:()=>0})
  assert.equal(result.processed.length,4)
  assert.equal(result.jobs.length,3)
  assert.equal(result.accessLimited,true)
  const failed=result.processed.find(row=>row.candidate.jobId===subset[1].jobId)
  assert.equal(failed.detailStatus,'UNVERIFIED')
})

test('ambiguous HOLD is processed and audited but excluded from worthwhile jobs',async()=>{
  const candidate={
    jobId:'9200000001',
    title:'Senior Project Manager',
    company:'Example Co',
    location:'Denmark',
    publishedAt:'2026-08-27',
    foundBy:[{key:'enterprise project manager',role:'Enterprise Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}],
  }
  const result=await runProfileJdBatch({
    candidates:[candidate],
    fetcher:async()=>genericDetail(candidate),
    freshnessDays:3,
    now:new Date('2026-08-27T12:00:00Z'),
    maxCandidates:30,
    safeBudgetMs:999999,
    clock:()=>0,
  })
  assert.equal(result.processed.length,1)
  assert.equal(result.jobs.length,0)
  assert.equal(result.stats.kept,0)
  assert.equal(result.processed[0].detailStatus,'PROCESSED')
  assert.equal(result.processed[0].audit.stage,'PROFILE_DOMAIN_AMBIGUOUS')
  assert.equal(result.processed[0].audit.decision,'HOLD')
  assert.equal('score' in result.processed[0].audit,false)
})
