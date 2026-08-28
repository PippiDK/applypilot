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
  mustHaves:[
    {id:'M1',requirement:'5+ years leading complex cross-functional technology initiatives',jdEvidence:['Minimum 5 years leading complex cross-functional technology initiatives.']},
    {id:'M2',requirement:'Experience with senior executive stakeholders',jdEvidence:['Demonstrated experience partnering with senior executives.']}
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

test('requires an explicit mustHaves array separate from hiring priorities',async()=>{
  const {validateJobAnalysis}=await load()
  assert.equal(typeof validateJobAnalysis,'function')
  const broken=structuredClone(validAnalysis)
  delete broken.mustHaves
  assert.throws(()=>validateJobAnalysis(broken),/must-haves/i)
})

test('must-haves use their own qualification requirements and JD evidence',async()=>{
  const {validateJobAnalysis}=await load()
  assert.equal(typeof validateJobAnalysis,'function')
  const broken=structuredClone(validAnalysis)
  broken.mustHaves=[{id:'M1',requirement:'',jdEvidence:[]}]
  assert.throws(()=>validateJobAnalysis(broken),/must-have/i)
})

test('professional summary writer contract accepts grounded claims',async()=>{
  const {validateProfessionalSummaryDraft}=await load()
  assert.equal(typeof validateProfessionalSummaryDraft,'function')
  const draft={
    tailoredText:'Senior delivery leader with end-to-end platform delivery and stakeholder governance experience.',
    claims:[
      {text:'Led end-to-end platform delivery.',evidenceIds:['E1']},
      {text:'Managed senior stakeholder governance.',evidenceIds:['E2']}
    ],
    why:'Moves the most relevant verified delivery evidence forward for this vacancy.'
  }
  assert.deepEqual(validateProfessionalSummaryDraft(draft),draft)
})

test('professional summary writer contract rejects claims without evidence IDs',async()=>{
  const {validateProfessionalSummaryDraft}=await load()
  assert.equal(typeof validateProfessionalSummaryDraft,'function')
  const draft={tailoredText:'Senior delivery leader.',claims:[{text:'Senior delivery leader.',evidenceIds:[]}],why:'Relevant.'}
  assert.throws(()=>validateProfessionalSummaryDraft(draft),/evidence/i)
})

test('truth guard assessment contract accepts only declared M4.10 issue codes',async()=>{
  const {validateTruthGuardAssessment}=await load()
  assert.equal(typeof validateTruthGuardAssessment,'function')
  const valid={verdict:'FAIL',issues:[{code:'OVERCLAIM',claim:'Owned the programme.'}]}
  assert.deepEqual(validateTruthGuardAssessment(valid),valid)
  assert.throws(()=>validateTruthGuardAssessment({verdict:'FAIL',issues:[{code:'MADE_UP_CODE',claim:'Claim'}]}),/issue code/i)
})

test('truth guard PASS cannot contain unresolved issues and FAIL must contain at least one issue',async()=>{
  const {validateTruthGuardAssessment}=await load()
  assert.equal(typeof validateTruthGuardAssessment,'function')
  assert.throws(()=>validateTruthGuardAssessment({verdict:'PASS',issues:[{code:'UNSUPPORTED',claim:'Claim'}]}),/pass.*issues|issues.*pass/i)
  assert.throws(()=>validateTruthGuardAssessment({verdict:'FAIL',issues:[]}),/fail.*issue|issue.*fail/i)
})
