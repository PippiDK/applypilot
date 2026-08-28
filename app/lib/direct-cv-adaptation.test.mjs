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

test('requestCvAdaptation sends selected CV and JD directly to exactly the three writer actions',async()=>{
  const {requestCvAdaptation}=await import('./cv-adaptation-client.js')
  assert.equal(typeof requestCvAdaptation,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  const calls=[]
  const fetchImpl=async(_url,options)=>{
    const body=JSON.parse(options.body)
    calls.push(body)
    if(body.action==='write_professional_summary') return {ok:true,json:async()=>({stage:'summary_written',block:block('professional_summary','Original summary','Updated summary')})}
    if(body.action==='write_latest_role_overview') return {ok:true,json:async()=>({stage:'latest_role_written',block:block('latest_role_overview','Original latest','Updated latest')})}
    if(body.action==='write_previous_role_overview') return {ok:true,json:async()=>({stage:'previous_role_written',block:block('previous_role_overview','Original previous','Updated previous')})}
    throw new Error(`Unexpected action ${body.action}`)
  }

  const result=await requestCvAdaptation({baseline,job,fetchImpl})
  assert.deepEqual(calls.map(call=>call.action),['write_professional_summary','write_latest_role_overview','write_previous_role_overview'])
  for(const call of calls){
    assert.deepEqual(call.sourceCv,sourceCv)
    assert.equal(call.job.sourceJobId,'JOB-1')
    assert.equal(call.job.description,job.description)
    assert.equal('token' in call,false)
  }
  const wire=JSON.stringify(calls)
  assert.equal(wire.includes('map_selected_cv_evidence'),false)
  assert.equal(wire.includes('run_truth_guard'),false)
  assert.equal(wire.includes('analyze_job'),false)
  assert.equal(result.stage,'adaptation_written')
  assert.deepEqual(Object.keys(result.blocks),['professionalSummary','latestRoleOverview','previousRoleOverview'])
})

test('all three writers receive the selected CV and JD directly and return AI text without evidence objects',async()=>{
  const pipeline=await import('./tailoring-pipeline.js')
  const previousModule=await import('./previous-role-overview.js')
  const structure=detectCvStructure(cvText)
  const requests=[]
  const modelCall=async request=>{
    requests.push(request)
    return {tailoredText:`Updated ${request.stage}`,why:'Updated for this vacancy.'}
  }

  const summary=await pipeline.writeProfessionalSummary({job,sourceCv,structure},modelCall)
  const latest=await pipeline.writeLatestRoleOverview({job,sourceCv,structure},modelCall)
  const previous=await previousModule.writePreviousRoleOverview({job,sourceCv,structure},modelCall)

  assert.equal(summary.tailoredText,'Updated professional_summary_writer')
  assert.equal(latest.tailoredText,'Updated latest_role_overview_writer')
  assert.equal(previous.tailoredText,'Updated previous_role_overview_writer')
  assert.equal(requests.length,3)
  for(const request of requests){
    assert.equal(request.input.sourceCv.cvText,cvText)
    assert.equal(request.input.job.description,job.description)
    assert.equal('analysis' in request.input,false)
    assert.equal('evidence' in request.input,false)
    assert.equal('supportedRequirements' in request.input,false)
  }
})

test('review shows writer tailoredText directly without Truth Guard',async()=>{
  const {adaptationReviewBlocks}=await import('./cv-adaptation-decisions.js')
  assert.equal(typeof adaptationReviewBlocks,'function')
  const blocks={
    professionalSummary:block('professional_summary','Original summary','AI summary'),
    latestRoleOverview:block('latest_role_overview','Original latest','AI latest'),
    previousRoleOverview:block('previous_role_overview','Original previous','AI previous')
  }
  const review=adaptationReviewBlocks({blocks})
  assert.deepEqual(review.map(item=>item.updated),['AI summary','AI latest','AI previous'])
  assert.deepEqual(review.map(item=>item.original),['Original summary','Original latest','Original previous'])
})
