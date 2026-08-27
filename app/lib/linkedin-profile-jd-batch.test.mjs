import test from 'node:test'
import assert from 'node:assert/strict'
import {runProfileJdBatch} from './linkedin-profile-jd-batch.js'

const direction={key:'it project manager',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}
const candidates=Array.from({length:35},(_,i)=>({jobId:String(9100000000+i),title:`IT Project Manager ${i+1}`,company:'Example Co',location:'Denmark',publishedAt:'2026-08-27',foundBy:[direction]}))

function detail(candidate,{company=candidate.company,descriptionSuffix=''}={}){
  const description='Lead IT projects delivering software platforms, integrations, milestones, dependencies and technical outcomes across teams. '.repeat(5)+descriptionSuffix
  const data={"@context":"https://schema.org","@type":"JobPosting",title:candidate.title,datePosted:'2026-08-27',validThrough:'2026-09-30',employmentType:'FULL_TIME',hiringOrganization:{"@type":"Organization",name:company},jobLocation:{"@type":"Place",address:{"@type":"PostalAddress",addressLocality:'Copenhagen',addressCountry:'Denmark'}},description}
  return `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body><div class="show-more-less-html__markup">${description}</div></body></html>`
}

const semanticKeep=async args=>({results:args.input.items.map(item=>({
  jobId:item.jobId,
  compatible:true,
  directionKey:item.directions[0].key,
  score:90,
  reason:'match'
}))})

test('candidate 31+ is preserved for a later invocation when max batch is 30',async()=>{
  const fetcher=async url=>detail(candidates.find(row=>url.endsWith(row.jobId)))
  const first=await runProfileJdBatch({candidates,fetcher,modelCall:semanticKeep,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:999999,clock:()=>0})
  assert.equal(first.processed.length,30)
  assert.equal(first.remaining.length,5)
  assert.equal(first.remaining[0].jobId,candidates[30].jobId)
  const second=await runProfileJdBatch({candidates:first.remaining,fetcher,modelCall:semanticKeep,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:999999,clock:()=>0})
  assert.equal(second.processed.length,5)
  assert.equal(second.remaining.length,0)
  assert.equal(first.jobs.length+second.jobs.length,35)
})

test('safe time budget stops early without classifying untouched candidates as failures',async()=>{
  let tick=0
  const clock=()=>tick
  const fetcher=async url=>{ tick+=40; return detail(candidates.find(row=>url.endsWith(row.jobId))) }
  const result=await runProfileJdBatch({candidates:candidates.slice(0,10),fetcher,modelCall:semanticKeep,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:100,clock})
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
  const result=await runProfileJdBatch({candidates:subset,fetcher,modelCall:semanticKeep,freshnessDays:3,now:new Date('2026-08-27T12:00:00Z'),maxCandidates:30,safeBudgetMs:999999,clock:()=>0})
  assert.equal(result.processed.length,4)
  assert.equal(result.jobs.length,3)
  assert.equal(result.accessLimited,true)
  const failed=result.processed.find(row=>row.candidate.jobId===subset[1].jobId)
  assert.equal(failed.detailStatus,'UNVERIFIED')
})

test('verified jobs are evaluated semantically in chunks of at most 8',async()=>{
  const artCandidates=Array.from({length:9},(_,i)=>({jobId:String(i+1),title:'Senior Concept Artist',company:'Studio',location:'Denmark',publishedAt:'2026-08-27',foundBy:[{key:'artist',role:'Concept Artist',tier:'primary'}]}))
  const calls=[]
  const modelCall=async args=>{
    calls.push(args.input.items.map(item=>item.jobId))
    return {results:args.input.items.map(item=>({jobId:item.jobId,compatible:true,directionKey:'artist',score:90,reason:'match'}))}
  }
  const result=await runProfileJdBatch({
    candidates:artCandidates,
    fetcher:async url=>detail(artCandidates.find(row=>url.endsWith(row.jobId))),
    modelCall,
    maxCandidates:9,
    safeBudgetMs:999999,
    now:new Date('2026-08-27T12:00:00Z'),
    clock:()=>0
  })
  assert.deepEqual(calls.map(x=>x.length),[8,1])
  assert.equal(result.jobs.length,9)
})

test('deterministically excluded vacancy never consumes semantic AI capacity',async()=>{
  let calls=0
  const candidate={jobId:'1',title:'Project Manager',company:'Blocked Co',location:'Denmark',publishedAt:'2026-08-27',foundBy:[{key:'pm',role:'Project Manager',tier:'primary'}]}
  const result=await runProfileJdBatch({
    candidates:[candidate],
    fetcher:async()=>detail(candidate,{company:'Blocked Co'}),
    exclusionRules:[{category:'company',operator:'exclude',value:'Blocked Co',evaluation:'deterministic',originalText:'no Blocked Co'}],
    modelCall:async()=>{calls++;return {results:[]}},
    now:new Date('2026-08-27T12:00:00Z')
  })
  assert.equal(calls,0)
  assert.equal(result.processed[0].audit.stage,'PROFILE_EXCLUSION_REJECT')
})

test('semantic provider failure marks only that semantic chunk UNVERIFIED and access limited',async()=>{
  const candidate={jobId:'1',title:'Senior Concept Artist',company:'Studio',location:'Denmark',publishedAt:'2026-08-27',foundBy:[{key:'artist',role:'Concept Artist',tier:'primary'}]}
  const result=await runProfileJdBatch({
    candidates:[candidate],
    fetcher:async()=>detail(candidate),
    modelCall:async()=>{throw Object.assign(new Error('provider down'),{code:'AI_PROVIDER_HTTP_503'})},
    now:new Date('2026-08-27T12:00:00Z')
  })
  assert.equal(result.accessLimited,true)
  assert.equal(result.processed[0].detailStatus,'UNVERIFIED')
  assert.equal(result.processed[0].audit.stage,'SEMANTIC_EVALUATION_UNVERIFIED')
  assert.equal(result.jobs.length,0)
})

test('semantic input preserves the complete Full JD including a unique suffix',async()=>{
  const suffix=' UNIQUE-FULL-JD-END-MARKER-987654321'
  const candidate={jobId:'1',title:'Senior Concept Artist',company:'Studio',location:'Denmark',publishedAt:'2026-08-27',foundBy:[{key:'artist',role:'Concept Artist',tier:'primary'}]}
  let seenDescription=''
  await runProfileJdBatch({
    candidates:[candidate],
    fetcher:async()=>detail(candidate,{descriptionSuffix:suffix}),
    modelCall:async args=>{
      seenDescription=args.input.items[0].description
      return {results:[{jobId:'1',compatible:true,directionKey:'artist',score:90,reason:'match'}]}
    },
    now:new Date('2026-08-27T12:00:00Z')
  })
  assert.match(seenDescription,/UNIQUE-FULL-JD-END-MARKER-987654321$/)
})
