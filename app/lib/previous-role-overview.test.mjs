import test from 'node:test'
import assert from 'node:assert/strict'
import {detectCvStructure,roleLengthWindow} from './cv-sections.js'

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

test('writePreviousRoleOverview uses only evidence from the detected previous employment section',async()=>{
  const {writePreviousRoleOverview}=await loadPipeline()
  assert.equal(typeof writePreviousRoleOverview,'function')
  const {structure,evidence}=fixture()
  let received
  const modelCall=async request=>{
    received=request
    return {
      tailoredText:'Led stakeholder governance and operational handover across regulated financial IT delivery initiatives.',
      claims:[{text:'Led stakeholder governance and operational handover.',evidenceIds:['E2']}],
      why:'Emphasises verified stakeholder evidence from the previous role.'
    }
  }
  const before=structuredClone(structure)
  const block=await writePreviousRoleOverview({analysis,evidence,structure},modelCall)
  assert.equal(block.blockId,'previous_role_overview')
  assert.equal(block.status,'generated')
  assert.equal(block.roleId,structure.previousRole.id)
  assert.equal(block.title,structure.previousRole.title)
  assert.equal(block.company,structure.previousRole.company)
  assert.equal(block.dateText,structure.previousRole.dateText)
  assert.equal(block.originalText,structure.previousRole.overviewText)
  assert.deepEqual(received.input.evidence.map(item=>item.id),['E2'])
  assert.deepEqual(received.input.supportedRequirements.map(item=>item.id),['P2'])
  assert.equal(JSON.stringify(received.input).includes('Led end-to-end platform delivery and customer readiness.'),false)
  assert.equal(JSON.stringify(received.input).includes('Senior delivery leader with regulated enterprise experience.'),false)
  assert.deepEqual(received.input.lengthWindow,roleLengthWindow(structure.previousRole.overviewWordCount))
  assert.match(received.instructions,/previous role|previous employment/i)
  assert.match(received.instructions,/same employment section|role-local/i)
  assert.deepEqual(structure,before)
})

test('writePreviousRoleOverview rejects evidence IDs from the latest employment role',async()=>{
  const {writePreviousRoleOverview}=await loadPipeline()
  assert.equal(typeof writePreviousRoleOverview,'function')
  const {structure,evidence}=fixture()
  const draft={
    tailoredText:'Led end-to-end platform delivery and customer readiness.',
    claims:[{text:'Led end-to-end platform delivery and customer readiness.',evidenceIds:['E1']}],
    why:'Uses latest-role evidence.'
  }
  await assert.rejects(()=>writePreviousRoleOverview({analysis,evidence,structure},async()=>draft),/unknown evidence|role-local|evidence id/i)
})

test('writePreviousRoleOverview rejects numbers absent from previous-role evidence',async()=>{
  const {writePreviousRoleOverview}=await loadPipeline()
  assert.equal(typeof writePreviousRoleOverview,'function')
  const {structure,evidence}=fixture()
  const draft={
    tailoredText:'Led stakeholder governance and reduced manual reporting effort by 40% across regulated delivery.',
    claims:[{text:'Reduced manual reporting effort by 40%.',evidenceIds:['E2']}],
    why:'Adds a metric not present in the cited previous-role evidence.'
  }
  await assert.rejects(()=>writePreviousRoleOverview({analysis,evidence,structure},async()=>draft),/number|metric/i)
})

test('writePreviousRoleOverview enforces the existing previous-role overview length window',async()=>{
  const {writePreviousRoleOverview}=await loadPipeline()
  assert.equal(typeof writePreviousRoleOverview,'function')
  const {structure,evidence}=fixture()
  const tooLong=Array.from({length:roleLengthWindow(structure.previousRole.overviewWordCount).max+5},()=> 'delivery').join(' ')
  const draft={tailoredText:tooLong,claims:[{text:'Led stakeholder governance.',evidenceIds:['E2']}],why:'Too long.'}
  await assert.rejects(()=>writePreviousRoleOverview({analysis,evidence,structure},async()=>draft),/length|word/i)
})

test('writePreviousRoleOverview returns unavailable when the selected CV has no previous role',async()=>{
  const {writePreviousRoleOverview}=await loadPipeline()
  assert.equal(typeof writePreviousRoleOverview,'function')
  const structure=detectCvStructure(`Professional Summary\nDelivery leader.\nProfessional Experience\nProject Manager | One Ltd | 2022-Present\nLed delivery.`)
  const result=await writePreviousRoleOverview({analysis,evidence:{matches:[],unsupportedRequirementIds:['P1','P2','P3','M1']},structure},async()=>{throw new Error('AI should not run')})
  assert.equal(structure.previousRole,null)
  assert.equal(result.blockId,'previous_role_overview')
  assert.equal(result.status,'unavailable')
  assert.equal(result.tailoredText,'')
})
