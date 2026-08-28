import test from 'node:test'
import assert from 'node:assert/strict'
import {buildAdaptationBaseline} from './cv-adaptation-baseline.js'

async function load(){ return import('./cv-adaptation-client.js').catch(()=>({})) }

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
const job={sourceJobId:'JOB-1',title:'Senior Delivery Lead',company:'Hiring Co',location:'Copenhagen',description:'Lead complex end-to-end technology delivery across business and engineering teams, manage senior stakeholders, risks, dependencies, release readiness, and operational handover.'}

test('requestLatestRoleOverview continues the selected-CV chain after Professional Summary',async()=>{
  const {requestLatestRoleOverview}=await load()
  assert.equal(typeof requestLatestRoleOverview,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  const calls=[]
  const fetchImpl=async(_url,options)=>{
    const body=JSON.parse(options.body)
    calls.push(body)
    if(body.action==='analyze_job') return {ok:true,json:async()=>({stage:'job_analyzed',analysis:{roleMission:'Mission'},token:'TOKEN-1'})}
    if(body.action==='map_selected_cv_evidence') return {ok:true,json:async()=>({stage:'evidence_mapped',analysis:{roleMission:'Mission'},evidence:{matches:[{id:'E1'}],unsupportedRequirementIds:[]},token:'TOKEN-2'})}
    if(body.action==='write_professional_summary') return {ok:true,json:async()=>({stage:'summary_written',block:{blockId:'professional_summary',status:'generated',originalText:'Original summary',tailoredText:'Tailored summary',claims:[{text:'Claim',evidenceIds:['E1']}],why:'Why'},token:'TOKEN-3'})}
    if(body.action==='write_latest_role_overview') return {ok:true,json:async()=>({stage:'latest_role_written',blocks:{professionalSummary:{blockId:'professional_summary'},latestRoleOverview:{blockId:'latest_role_overview',status:'generated',roleId:'role:latest',originalText:'Original role',tailoredText:'Tailored role',claims:[{text:'Claim',evidenceIds:['E1']}],why:'Why'}},token:'TOKEN-4'})}
    throw new Error('Unexpected action')
  }
  const result=await requestLatestRoleOverview({baseline,job,fetchImpl})
  assert.equal(calls.length,4)
  assert.deepEqual(calls.map(call=>call.action),['analyze_job','map_selected_cv_evidence','write_professional_summary','write_latest_role_overview'])
  assert.equal(calls[3].token,'TOKEN-3')
  assert.deepEqual(calls[3].sourceCv,{cvId:'cv-2',sourceVersion:'sha256:cv2',fileName:'CV2.pdf',cvText})
  assert.equal(calls[3].job.sourceJobId,'JOB-1')
  assert.equal(result.blocks.latestRoleOverview.blockId,'latest_role_overview')
  const wire=JSON.stringify(calls)
  assert.equal(wire.includes('CV1_SENTINEL'),false)
  assert.equal(wire.includes('CV3_SENTINEL'),false)
})

test('requestLatestRoleOverview fails safely if the latest-role stage is rejected',async()=>{
  const {requestLatestRoleOverview}=await load()
  assert.equal(typeof requestLatestRoleOverview,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  let count=0
  const fetchImpl=async()=>{
    count++
    if(count===1) return {ok:true,json:async()=>({stage:'job_analyzed',token:'TOKEN-1'})}
    if(count===2) return {ok:true,json:async()=>({stage:'evidence_mapped',token:'TOKEN-2'})}
    if(count===3) return {ok:true,json:async()=>({stage:'summary_written',block:{blockId:'professional_summary'},token:'TOKEN-3'})}
    return {ok:false,json:async()=>({error:'Latest role overview failed safely.'})}
  }
  await assert.rejects(()=>requestLatestRoleOverview({baseline,job,fetchImpl}),/latest role overview/i)
})
