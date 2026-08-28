import test from 'node:test'
import assert from 'node:assert/strict'
import {detectCvStructure,roleLengthWindow} from './cv-sections.js'

async function loadContracts(){ return import('./ai-contracts.js').catch(()=>({})) }
async function loadPipeline(){ return import('./tailoring-pipeline.js').catch(()=>({})) }

const analysis={
  roleMission:'Deliver a complex enterprise platform initiative from planning through release.',
  candidatePositioning:'Senior technology delivery leader with strong cross-functional execution and stakeholder governance.',
  priorities:[
    {id:'P1',rank:1,kind:'must_have',requirement:'Lead end-to-end platform delivery',why:'Own delivery',jdEvidence:['Lead end-to-end platform delivery across business and technology teams.']},
    {id:'P2',rank:2,kind:'must_have',requirement:'Manage senior stakeholders',why:'Keep leaders aligned',jdEvidence:['Manage senior stakeholders and communicate delivery risks clearly.']},
    {id:'P3',rank:3,kind:'supporting',requirement:'Coordinate integrations and dependencies',why:'Control cross-team execution',jdEvidence:['Coordinate integrations and cross-team dependencies.']}
  ],
  mustHaves:[
    {id:'M1',requirement:'Senior stakeholder management experience',jdEvidence:['Manage senior stakeholders and communicate delivery risks clearly.']}
  ],
  gapsToAvoid:[]
}

const cvText=`Professional Summary
Senior delivery leader with regulated enterprise experience.

Professional Experience
Senior Project Manager
Example A/S
Jun 2022 - Mar 2026
Led end-to-end platform delivery and customer readiness.
Managed budgets, risks, dependencies, and go-live.
• Coordinated release readiness across distributed teams.

Senior IT Delivery Manager
Example Bank
Nov 2019 - May 2022
Delivered regulated financial IT initiatives and reporting automation.
Led stakeholder governance and operational handover.
• Reduced manual reporting effort by 40%.`

function fixture(){
  const structure=detectCvStructure(cvText)
  return {
    structure,
    evidence:{
      matches:[
        {id:'E1',requirementId:'P1',sectionId:structure.latestRole.id,excerpt:'Led end-to-end platform delivery and customer readiness.'},
        {id:'E2',requirementId:'P2',sectionId:structure.previousRole.id,excerpt:'Led stakeholder governance and operational handover.'},
        {id:'E3',requirementId:'P3',sectionId:'professional_summary',excerpt:'Senior delivery leader with regulated enterprise experience.'}
      ],
      unsupportedRequirementIds:['M1']
    }
  }
}

test('latest role writer contract accepts grounded claims',async()=>{
  const {validateRoleOverviewDraft}=await loadContracts()
  assert.equal(typeof validateRoleOverviewDraft,'function')
  const draft={
    tailoredText:'Led end-to-end platform delivery and customer readiness while managing delivery dependencies.',
    claims:[{text:'Led end-to-end platform delivery and customer readiness.',evidenceIds:['E1']}],
    why:'Moves verified role-local delivery evidence forward for this vacancy.'
  }
  assert.deepEqual(validateRoleOverviewDraft(draft),draft)
})

test('latest role writer contract rejects claims without evidence IDs',async()=>{
  const {validateRoleOverviewDraft}=await loadContracts()
  assert.equal(typeof validateRoleOverviewDraft,'function')
  const draft={tailoredText:'Led delivery.',claims:[{text:'Led delivery.',evidenceIds:[]}],why:'Relevant.'}
  assert.throws(()=>validateRoleOverviewDraft(draft),/evidence/i)
})

test('writeLatestRoleOverview uses only evidence from the detected latest employment section',async()=>{
  const {writeLatestRoleOverview}=await loadPipeline()
  assert.equal(typeof writeLatestRoleOverview,'function')
  const {structure,evidence}=fixture()
  let received
  const modelCall=async request=>{
    received=request
    return {
      tailoredText:'Led end-to-end platform delivery and customer readiness while managing budgets, risks, dependencies, and go-live.',
      claims:[{text:'Led end-to-end platform delivery and customer readiness.',evidenceIds:['E1']}],
      why:'Emphasises verified end-to-end delivery evidence from the latest role.'
    }
  }
  const before=structuredClone(structure)
  const block=await writeLatestRoleOverview({analysis,evidence,structure},modelCall)
  assert.equal(block.blockId,'latest_role_overview')
  assert.equal(block.status,'generated')
  assert.equal(block.roleId,structure.latestRole.id)
  assert.equal(block.title,structure.latestRole.title)
  assert.equal(block.company,structure.latestRole.company)
  assert.equal(block.dateText,structure.latestRole.dateText)
  assert.equal(block.originalText,structure.latestRole.overviewText)
  assert.deepEqual(received.input.evidence.map(item=>item.id),['E1'])
  assert.deepEqual(received.input.supportedRequirements.map(item=>item.id),['P1'])
  assert.equal(JSON.stringify(received.input).includes('Led stakeholder governance and operational handover.'),false)
  assert.equal(JSON.stringify(received.input).includes('Senior delivery leader with regulated enterprise experience.'),false)
  assert.deepEqual(received.input.lengthWindow,roleLengthWindow(structure.latestRole.overviewWordCount))
  assert.match(received.instructions,/latest role|latest employment/i)
  assert.match(received.instructions,/same employment section|role-local/i)
  assert.deepEqual(structure,before)
})

test('writeLatestRoleOverview rejects evidence IDs from another employment role',async()=>{
  const {writeLatestRoleOverview}=await loadPipeline()
  assert.equal(typeof writeLatestRoleOverview,'function')
  const {structure,evidence}=fixture()
  const draft={
    tailoredText:'Led stakeholder governance and operational handover.',
    claims:[{text:'Led stakeholder governance and operational handover.',evidenceIds:['E2']}],
    why:'Uses previous-role evidence.'
  }
  await assert.rejects(()=>writeLatestRoleOverview({analysis,evidence,structure},async()=>draft),/unknown evidence|role-local|evidence id/i)
})

test('writeLatestRoleOverview rejects numbers absent from latest-role evidence',async()=>{
  const {writeLatestRoleOverview}=await loadPipeline()
  assert.equal(typeof writeLatestRoleOverview,'function')
  const {structure,evidence}=fixture()
  const draft={
    tailoredText:'Led end-to-end platform delivery and improved readiness by 40%.',
    claims:[{text:'Improved readiness by 40%.',evidenceIds:['E1']}],
    why:'Adds an unsupported metric.'
  }
  await assert.rejects(()=>writeLatestRoleOverview({analysis,evidence,structure},async()=>draft),/number|metric/i)
})

test('writeLatestRoleOverview enforces the existing role overview length window',async()=>{
  const {writeLatestRoleOverview}=await loadPipeline()
  assert.equal(typeof writeLatestRoleOverview,'function')
  const {structure,evidence}=fixture()
  const tooLong=Array.from({length:roleLengthWindow(structure.latestRole.overviewWordCount).max+5},()=> 'delivery').join(' ')
  const draft={tailoredText:tooLong,claims:[{text:'Led end-to-end platform delivery.',evidenceIds:['E1']}],why:'Too long.'}
  await assert.rejects(()=>writeLatestRoleOverview({analysis,evidence,structure},async()=>draft),/length|word/i)
})

test('writeLatestRoleOverview returns unavailable without inventing content when latest overview is missing',async()=>{
  const {writeLatestRoleOverview}=await loadPipeline()
  assert.equal(typeof writeLatestRoleOverview,'function')
  const structure=detectCvStructure(`Professional Summary\nDelivery leader.\nProfessional Experience\nProject Manager | One Ltd | 2022-Present\n• Delivered releases.`)
  const result=await writeLatestRoleOverview({analysis,evidence:{matches:[],unsupportedRequirementIds:['P1','P2','P3','M1']},structure},async()=>{throw new Error('AI should not run')})
  assert.equal(result.blockId,'latest_role_overview')
  assert.equal(result.status,'unavailable')
  assert.equal(result.tailoredText,'')
})
