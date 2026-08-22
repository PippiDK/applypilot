import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeExpertiseMatch} from './expertise-service.js'

const job={
  title:'AI Product Manager',
  company:'Example',
  description:'Lead end-to-end delivery of AI initiatives. Experience delivering Generative AI solutions is required. Build strong relationships with senior stakeholders.'
}

const cvText='Senior IT Project and Delivery Manager with end-to-end delivery, executive reporting, stakeholder management and enterprise data platform experience across regulated environments.'

const aiResult={requirements:[
  {id:'delivery',capability:'End-to-end AI delivery',category:'delivery_execution',importance:'core',requirement:'Lead end-to-end delivery of AI initiatives.',minimumYears:0,directEvidenceTerms:['AI delivery'],transferableEvidenceTerms:['end-to-end delivery'],jdEvidence:['Lead end-to-end delivery of AI initiatives.']},
  {id:'genai',capability:'Generative AI delivery',category:'technical_platform_capabilities',importance:'critical',requirement:'Experience delivering Generative AI solutions is required.',minimumYears:0,directEvidenceTerms:['Generative AI'],transferableEvidenceTerms:['data platform'],jdEvidence:['Experience delivering Generative AI solutions is required.']},
  {id:'stake',capability:'Senior stakeholder leadership',category:'leadership_stakeholder_scope',importance:'core',requirement:'Build strong relationships with senior stakeholders.',minimumYears:0,directEvidenceTerms:['senior stakeholders','executive reporting'],transferableEvidenceTerms:['stakeholder management'],jdEvidence:['Build strong relationships with senior stakeholders.']}
]}

test('AI receives only the JD while deterministic code compares the resulting requirements with Source CV',async()=>{
  let captured
  const result=await analyzeExpertiseMatch({job,cvText,modelCall:async args=>{captured=args; return structuredClone(aiResult)}})
  assert.equal(captured.input.jobDescription,job.description)
  assert.equal(JSON.stringify(captured).includes(cvText),false)
  assert.equal(result.requirements.find(x=>x.id==='genai').status,'PARTIAL')
  assert.equal(result.requirements.find(x=>x.id==='stake').status,'MATCHED')
  assert.ok(result.expertiseMatch>0&&result.expertiseMatch<100)
})

test('fails safely when Source CV is missing rather than letting AI decide fit',async()=>{
  let called=false
  await assert.rejects(
    ()=>analyzeExpertiseMatch({job,cvText:'',modelCall:async()=>{called=true; return aiResult}}),
    /Source CV/i
  )
  assert.equal(called,false)
})
