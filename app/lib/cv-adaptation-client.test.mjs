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

test('requestSelectedCvEvidence sends only the selected CV through the adaptation stage chain',async()=>{
  const {requestSelectedCvEvidence}=await load()
  assert.equal(typeof requestSelectedCvEvidence,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  const calls=[]
  const fetchImpl=async(_url,options)=>{
    const body=JSON.parse(options.body)
    calls.push(body)
    if(body.action==='analyze_job') return {ok:true,json:async()=>({stage:'job_analyzed',analysis:{roleMission:'Mission',candidatePositioning:'Positioning',priorities:[],mustHaves:[],gapsToAvoid:[]},token:'TOKEN-1'})}
    if(body.action==='map_selected_cv_evidence') return {ok:true,json:async()=>({stage:'evidence_mapped',analysis:{roleMission:'Mission'},evidence:{matches:[],unsupportedRequirementIds:[]},structure:{professionalSummary:null,latestRole:null,previousRole:null},token:'TOKEN-2'})}
    throw new Error('Unexpected action')
  }
  const result=await requestSelectedCvEvidence({baseline,job,fetchImpl})
  assert.equal(calls.length,2)
  assert.deepEqual(calls[0],{action:'analyze_job',cvId:'cv-2',sourceVersion:'sha256:cv2',job:{sourceJobId:'JOB-1',title:'Senior Delivery Lead',company:'Hiring Co',location:'Copenhagen',description:job.description}})
  assert.equal(calls[1].action,'map_selected_cv_evidence')
  assert.equal(calls[1].token,'TOKEN-1')
  assert.deepEqual(calls[1].sourceCv,{cvId:'cv-2',sourceVersion:'sha256:cv2',fileName:'CV2.pdf',cvText})
  const wire=JSON.stringify(calls)
  assert.equal(wire.includes('CV1_SENTINEL'),false)
  assert.equal(wire.includes('CV3_SENTINEL'),false)
  assert.equal(JSON.stringify(result).includes('tailoredText'),false)
})

test('requestSelectedCvEvidence fails safely when the server rejects the selected-CV stage',async()=>{
  const {requestSelectedCvEvidence}=await load()
  assert.equal(typeof requestSelectedCvEvidence,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  let count=0
  const fetchImpl=async()=>{
    count++
    if(count===1) return {ok:true,json:async()=>({stage:'job_analyzed',analysis:{},token:'TOKEN-1'})}
    return {ok:false,json:async()=>({error:'Selected CV binding does not match the analysed stage.'})}
  }
  await assert.rejects(()=>requestSelectedCvEvidence({baseline,job,fetchImpl}),/selected cv binding/i)
})

test('requestProfessionalSummary continues the selected-CV chain into Summary writing only',async()=>{
  const {requestProfessionalSummary}=await load()
  assert.equal(typeof requestProfessionalSummary,'function')
  const baseline=buildAdaptationBaseline({job,cv})
  const calls=[]
  const fetchImpl=async(_url,options)=>{
    const body=JSON.parse(options.body)
    calls.push(body)
    if(body.action==='analyze_job') return {ok:true,json:async()=>({stage:'job_analyzed',analysis:{roleMission:'Mission'},token:'TOKEN-1'})}
    if(body.action==='map_selected_cv_evidence') return {ok:true,json:async()=>({stage:'evidence_mapped',analysis:{roleMission:'Mission'},evidence:{matches:[{id:'E1'}],unsupportedRequirementIds:[]},token:'TOKEN-2'})}
    if(body.action==='write_professional_summary') return {ok:true,json:async()=>({stage:'summary_written',block:{blockId:'professional_summary',status:'generated',originalText:'Original',tailoredText:'Tailored',claims:[{text:'Claim',evidenceIds:['E1']}],why:'Why'},token:'TOKEN-3'})}
    throw new Error('Unexpected action')
  }
  const result=await requestProfessionalSummary({baseline,job,fetchImpl})
  assert.equal(calls.length,3)
  assert.equal(calls[2].action,'write_professional_summary')
  assert.equal(calls[2].token,'TOKEN-2')
  assert.deepEqual(calls[2].sourceCv,{cvId:'cv-2',sourceVersion:'sha256:cv2',fileName:'CV2.pdf',cvText})
  assert.equal(calls[2].job.sourceJobId,'JOB-1')
  assert.equal(result.block.blockId,'professional_summary')
  assert.equal(JSON.stringify(calls).includes('CV1_SENTINEL'),false)
  assert.equal(JSON.stringify(calls).includes('CV3_SENTINEL'),false)
})
