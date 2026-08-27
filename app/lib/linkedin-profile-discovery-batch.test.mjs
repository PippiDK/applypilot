import test from 'node:test'
import assert from 'node:assert/strict'
import {createDiscoveryState,runDiscoveryBatch} from './linkedin-profile-discovery-batch.js'

const plan={version:'union-search-plan-v1',directions:[
  {key:'technical project manager',role:'Technical Project Manager',tier:'primary',origin:'cv',cvSlots:[1]},
  {key:'it delivery manager',role:'IT Delivery Manager',tier:'primary',origin:'cv',cvSlots:[1]},
]}

const page=(ids=[])=>ids.map(id=>`<li><a href="https://www.linkedin.com/jobs/view/${id}/"></a><h3 class="base-search-card__title">Role ${id}</h3><h4 class="base-search-card__subtitle">Company ${id}</h4><span class="job-search-card__location">Denmark</span><time datetime="2026-08-27"></time></li>`).join('')

function startOf(url){return Number(new URL(url).searchParams.get('start'))}
function keywordOf(url){return new URL(url).searchParams.get('keywords')}

test('discovery continues beyond start=50 and reaches 100 when unique rows continue',async()=>{
  const seen=[]
  const fetcher=async url=>{
    const start=startOf(url); seen.push(start)
    if(start>100) return ''
    return page(Array.from({length:25},(_,i)=>String(9000000000+start+i)))
  }
  let state=createDiscoveryState({directions:[plan.directions[0]]})
  let known=[]
  for(let i=0;i<10&&!state.complete;i++){
    const result=await runDiscoveryBatch({freshnessDays:3,unionSearchPlan:{directions:[plan.directions[0]]},state,knownCandidates:known,fetcher,maxRequests:2})
    state=result.state; known=result.candidates
  }
  assert.equal(seen.includes(75),true)
  assert.equal(seen.includes(100),true)
  assert.equal(state.complete,true)
})

test('exact repeated page fingerprint completes a direction without infinite paging',async()=>{
  const same=page(['1','2','3'])
  const fetcher=async()=>same
  let state=createDiscoveryState({directions:[plan.directions[0]]})
  let known=[]
  for(let i=0;i<4&&!state.complete;i++){
    const result=await runDiscoveryBatch({freshnessDays:7,unionSearchPlan:{directions:[plan.directions[0]]},state,knownCandidates:known,fetcher,maxRequests:1})
    state=result.state; known=result.candidates
  }
  assert.equal(state.complete,true)
  assert.equal(known.length,3)
})

test('two consecutive pages with no new job ids complete a direction',async()=>{
  const responses=[page(['11','12']),page(['12']),page(['11'])]
  let call=0
  const fetcher=async()=>responses[Math.min(call++,responses.length-1)]
  let state=createDiscoveryState({directions:[plan.directions[0]]})
  let known=[]
  for(let i=0;i<5&&!state.complete;i++){
    const result=await runDiscoveryBatch({freshnessDays:14,unionSearchPlan:{directions:[plan.directions[0]]},state,knownCandidates:known,fetcher,maxRequests:1})
    state=result.state; known=result.candidates
  }
  assert.equal(state.complete,true)
  assert.equal(known.length,2)
})

test('duplicate job across role directions is one candidate with merged foundBy provenance',async()=>{
  const fetcher=async url=>startOf(url)===0?page(['777']):''
  let state=createDiscoveryState(plan)
  let known=[]
  while(!state.complete){
    const result=await runDiscoveryBatch({freshnessDays:3,unionSearchPlan:plan,state,knownCandidates:known,fetcher,maxRequests:2})
    state=result.state; known=result.candidates
  }
  assert.equal(known.length,1)
  assert.deepEqual(new Set(known[0].foundBy.map(item=>item.role)),new Set(['Technical Project Manager','IT Delivery Manager']))
})

test('access failure marks ACCESS LIMITED while retaining resumable state',async()=>{
  const fetcher=async url=>{
    if(keywordOf(url)==='Technical Project Manager'&&startOf(url)===25) throw new Error('LinkedIn public page returned an access wall/challenge')
    return startOf(url)===0?page(['501']):''
  }
  let state=createDiscoveryState(plan)
  let known=[]
  while(!state.complete){
    const result=await runDiscoveryBatch({freshnessDays:7,unionSearchPlan:plan,state,knownCandidates:known,fetcher,maxRequests:3})
    state=result.state; known=result.candidates
  }
  assert.equal(state.accessLimited,true)
  assert.equal(known.some(row=>row.jobId==='501'),true)
})
