import test from 'node:test'
import assert from 'node:assert/strict'
import {buildAdaptationBaseline} from './cv-adaptation-baseline.js'
import {detectCvStructure} from './cv-sections.js'

const cvText=`Professional Summary
Senior delivery leader with regulated enterprise experience.

Professional Experience
Senior Project Manager
Example A/S
Jun 2022 - Mar 2026
Led end-to-end platform delivery and customer readiness.
Managed budgets, risks, dependencies, and go-live.

Senior IT Delivery Manager
Example Bank
Nov 2019 - May 2022
Delivered regulated financial IT initiatives and reporting automation.
Led stakeholder governance and operational handover.`

const cv={id:'cv-2',slot:2,status:'ready',fileName:'CV2.pdf',sourceVersion:'sha256:cv2',cvText,summary:'Summary',facts:[],skills:[]}
const sourceCv={cvId:'cv-2',sourceVersion:'sha256:cv2',fileName:'CV2.pdf',cvText}
const job={sourceJobId:'JOB-1',title:'Senior Delivery Lead',company:'Hiring Co',location:'Copenhagen',description:'Lead complex end-to-end technology delivery across business and engineering teams, manage senior stakeholders, risks, dependencies, release readiness, and operational handover.'}

function block(blockId,originalText,tailoredText){
  return {blockId,status:'generated',originalText,tailoredText,why:'Updated for this vacancy.'}
}

test('requestCvAdaptation sends selected CV and JD in one adaptation request',async()=>{
  const {requestCvAdaptation}=await import('./cv-adaptation-client.js')
  const baseline=buildAdaptationBaseline({job,cv})
  const calls=[]
  const blocks={
    professionalSummary:block('professional_summary','Original summary','Updated summary'),
    latestRoleOverview:block('latest_role_overview','Original latest','Updated latest'),
    previousRoleOverview:block('previous_role_overview','Original previous','Updated previous')
  }
  const fetchImpl=async(_url,options)=>{
    const body=JSON.parse(options.body)
    calls.push(body)
    return {ok:true,json:async()=>({stage:'adaptation_written',blocks})}
  }

  const result=await requestCvAdaptation({baseline,job,fetchImpl})
  assert.equal(calls.length,1)
  assert.equal(calls[0].action,'adapt_cv')
  assert.deepEqual(calls[0].sourceCv,sourceCv)
  assert.equal(calls[0].job.sourceJobId,'JOB-1')
  assert.equal(calls[0].job.description,job.description)
  assert.equal(result.stage,'adaptation_written')
  assert.deepEqual(Object.keys(result.blocks),['professionalSummary','latestRoleOverview','previousRoleOverview'])
})

test('one AI call receives selected CV and JD and returns all three updated blocks',async()=>{
  const {writeCvAdaptation}=await import('./direct-cv-adaptation.js')
  const structure=detectCvStructure(cvText)
  const requests=[]
  const modelCall=async request=>{
    requests.push(request)
    return {
      professionalSummary:{tailoredText:'Updated summary',why:'Summary reason'},
      latestRoleOverview:{tailoredText:'Updated latest',why:'Latest reason'},
      previousRoleOverview:{tailoredText:'Updated previous',why:'Previous reason'}
    }
  }

  const blocks=await writeCvAdaptation({job,sourceCv,structure},modelCall)

  assert.equal(requests.length,1)
  assert.equal(requests[0].input.sourceCv.cvText,cvText)
  assert.equal(requests[0].input.job.description,job.description)
  assert.equal(blocks.professionalSummary.tailoredText,'Updated summary')
  assert.equal(blocks.latestRoleOverview.tailoredText,'Updated latest')
  assert.equal(blocks.previousRoleOverview.tailoredText,'Updated previous')
})

test('review shows AI tailoredText directly without Truth Guard',async()=>{
  const {adaptationReviewBlocks}=await import('./cv-adaptation-decisions.js')
  const blocks={
    professionalSummary:block('professional_summary','Original summary','AI summary'),
    latestRoleOverview:block('latest_role_overview','Original latest','AI latest'),
    previousRoleOverview:block('previous_role_overview','Original previous','AI previous')
  }
  const review=adaptationReviewBlocks({blocks})
  assert.deepEqual(review.map(item=>item.updated),['AI summary','AI latest','AI previous'])
  assert.deepEqual(review.map(item=>item.original),['Original summary','Original latest','Original previous'])
})
