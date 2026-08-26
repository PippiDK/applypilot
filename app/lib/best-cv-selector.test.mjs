import test from 'node:test'
import assert from 'node:assert/strict'
import {BEST_CV_SELECTOR_VERSION,buildSelectorPacket,validateBestCvResult,analyzeBestCv} from './best-cv-selector.js'

function cv(slot,version,extra=''){
  const name=`cv-${slot}.pdf`
  const text=`Yulia Example\nSenior IT Delivery Manager\n\nProfessional Summary\nSenior technology delivery leader with enterprise transformation experience.\n\nProfessional Experience\nSenior Project Manager | Example Co | 2022 – Present\nLed end-to-end software delivery, governance, stakeholders and go-live across distributed teams. ${extra}\n\nDelivery Manager | Bank Co | 2019 – 2022\nLed regulated platform delivery and transformation.\n\nSkills\nJira Azure DevOps Governance Risk Dependencies`.repeat(2)
  return {id:`cv-${slot}`,slot,fileName:name,sourceVersion:version,cvText:text,summary:'Senior technology delivery leader with enterprise transformation experience.',skills:['Jira','Azure DevOps','Governance']}
}

const job={sourceJobId:'123',title:'Senior Delivery Manager',company:'Acme',location:'Copenhagen',description:'Lead enterprise technology delivery from planning through go-live, managing governance, stakeholders and dependencies. '.repeat(4)}

test('selector packet preserves recruiter positioning without AI and is deterministic',()=>{
  const source=cv(1,'v1')
  const first=buildSelectorPacket(source)
  const second=buildSelectorPacket(source)
  assert.deepEqual(first,second)
  assert.equal(first.id,'cv-1')
  assert.equal(first.label,'CV 1')
  assert.equal(first.sourceVersion,'v1')
  assert.match(first.content,/Senior IT Delivery Manager/i)
  assert.match(first.content,/enterprise transformation/i)
  assert.match(first.content,/end-to-end software delivery/i)
  assert.ok(first.content.length<source.cvText.length+source.summary.length+500)
})

test('unsafe CV structure falls back to complete parsed CV text rather than losing evidence',()=>{
  const source=cv(2,'v2').cvText.replace(/Professional Summary|Professional Experience/gi,'')
  const candidate={...cv(2,'v2'),cvText:source,summary:''}
  const packet=buildSelectorPacket(candidate)
  assert.equal(packet.mode,'full_text_fallback')
  assert.equal(packet.content,candidate.cvText.trim())
})

test('Best CV validation only accepts supplied CV ids, complete unique ranking and valid advice',()=>{
  const valid=validateBestCvResult({recommendedCvId:'cv-2',rankedCvIds:['cv-2','cv-1','cv-3'],reason:'CV 2 positions the most relevant delivery evidence highest.',recommendation:'update_recommended',updateFocus:['Professional Summary']},['cv-1','cv-2','cv-3'])
  assert.equal(valid.recommendedCvId,'cv-2')
  assert.equal(valid.selectorVersion,BEST_CV_SELECTOR_VERSION)
  assert.throws(()=>validateBestCvResult({...valid,recommendedCvId:'cv-4'},['cv-1','cv-2','cv-3']),/candidate/i)
  assert.throws(()=>validateBestCvResult({...valid,rankedCvIds:['cv-2','cv-2','cv-1']},['cv-1','cv-2','cv-3']),/ranking/i)
  assert.throws(()=>validateBestCvResult({...valid,recommendation:'rewrite_everything'},['cv-1','cv-2','cv-3']),/recommendation/i)
})

test('Best CV compares all ready CVs in one structured AI call and never requests a merged CV',async()=>{
  const candidates=[cv(1,'v1'),cv(2,'v2'),cv(3,'v3')]
  let calls=0,captured
  const modelCall=async args=>{
    calls++
    captured=args
    return {recommendedCvId:'cv-2',rankedCvIds:['cv-2','cv-1','cv-3'],reason:'CV 2 has the strongest recruiter positioning for this JD.',recommendation:'use_as_is',updateFocus:[]}
  }
  const result=await analyzeBestCv({job,cvs:candidates,modelCall})
  assert.equal(calls,1)
  assert.equal(captured.stage,'best_cv_selector')
  assert.equal(captured.input.candidates.length,3)
  assert.deepEqual(captured.input.candidates.map(item=>item.id),['cv-1','cv-2','cv-3'])
  assert.match(captured.instructions,/never merge|do not merge/i)
  assert.equal(result.recommendedCvId,'cv-2')
  assert.equal(result.recommendation,'use_as_is')
})
