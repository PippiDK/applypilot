import test from 'node:test'
import assert from 'node:assert/strict'

async function load(){ return import('./ai-contracts.js').catch(()=>({})) }

const validAnalysis={
  roleMission:'Deliver a multi-country enterprise platform transformation.',
  candidatePositioning:'Senior delivery leader for cross-functional platform execution.',
  priorities:[
    {id:'P1',rank:1,kind:'must_have',requirement:'Lead end-to-end platform delivery',why:'Core accountability',jdEvidence:['Lead end-to-end platform delivery across business and technology teams.']},
    {id:'P2',rank:2,kind:'must_have',requirement:'Manage senior stakeholders',why:'Executive alignment',jdEvidence:['Manage senior stakeholders and communicate delivery risks clearly.']},
    {id:'P3',rank:3,kind:'supporting',requirement:'Coordinate integrations',why:'Technical dependency management',jdEvidence:['Coordinate integrations and cross-team dependencies.']}
  ],
  gapsToAvoid:['Do not assume ERP ownership.']
}

test('accepts a JD analysis with 3 to 5 grounded priorities',async()=>{
  const {validateJobAnalysis}=await load()
  assert.equal(typeof validateJobAnalysis,'function')
  assert.deepEqual(validateJobAnalysis(validAnalysis),validAnalysis)
})

test('rejects fewer than 3 priorities',async()=>{
  const {validateJobAnalysis}=await load()
  assert.equal(typeof validateJobAnalysis,'function')
  assert.throws(()=>validateJobAnalysis({...validAnalysis,priorities:validAnalysis.priorities.slice(0,2)}),/3 to 5/i)
})

test('rejects more than 5 priorities',async()=>{
  const {validateJobAnalysis}=await load()
  assert.equal(typeof validateJobAnalysis,'function')
  const extra=[4,5,6].map(n=>({id:`P${n}`,rank:n,kind:'supporting',requirement:`Requirement ${n}`,why:'Relevant',jdEvidence:[`Requirement ${n} appears in JD.`]}))
  assert.throws(()=>validateJobAnalysis({...validAnalysis,priorities:[...validAnalysis.priorities,...extra]}),/3 to 5/i)
})

test('requires exact JD evidence for every priority',async()=>{
  const {validateJobAnalysis}=await load()
  assert.equal(typeof validateJobAnalysis,'function')
  const broken=structuredClone(validAnalysis)
  broken.priorities[1].jdEvidence=[]
  assert.throws(()=>validateJobAnalysis(broken),/JD evidence/i)
})
