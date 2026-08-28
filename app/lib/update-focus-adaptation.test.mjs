import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {writeCvAdaptation} from './direct-cv-adaptation.js'
import {requestCvAdaptation} from './cv-adaptation-client.js'
import {buildAdaptationBaseline} from './cv-adaptation-baseline.js'

const updateFocus=[
  'Emphasize high-tech international delivery',
  'Bring release readiness and operational transition forward'
]
const cvText=`Professional Summary
Senior delivery leader with enterprise technology experience.

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
const cv={id:'cv-1',slot:1,status:'ready',fileName:'CV1.pdf',sourceVersion:'sha256:cv1',cvText,summary:'Summary',facts:[],skills:[],updateFocus}
const job={sourceJobId:'JOB-1',title:'Senior Project Manager',company:'Hiring Co',location:'Copenhagen',description:'Lead complex technology delivery across business and engineering teams, manage senior stakeholders, risks, dependencies, release readiness, and operational handover.'}

function blocks(){
  return {
    professionalSummary:{blockId:'professional_summary'},
    latestRoleOverview:{blockId:'latest_role_overview'},
    previousRoleOverview:{blockId:'previous_role_overview'}
  }
}

test('selected CV baseline carries Best CV update focus',()=>{
  const baseline=buildAdaptationBaseline({job,cv})
  assert.deepEqual(baseline.updateFocus,updateFocus)
})

test('single adaptation request sends Best CV update focus',async()=>{
  const baseline=buildAdaptationBaseline({job,cv})
  const calls=[]
  await requestCvAdaptation({
    baseline,
    job,
    fetchImpl:async(_url,options)=>{
      calls.push(JSON.parse(options.body))
      return {ok:true,json:async()=>({stage:'adaptation_written',blocks:blocks()})}
    }
  })
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0].updateFocus,updateFocus)
})

test('single AI call receives Best CV update focus as guidance',async()=>{
  const structure={
    professionalSummary:{text:'Original summary'},
    latestRole:{id:'role-1',title:'Senior Project Manager',company:'Example A/S',dateText:'2022 - 2026',overviewText:'Original latest'},
    previousRole:{id:'role-2',title:'Senior IT Delivery Manager',company:'Example Bank',dateText:'2019 - 2022',overviewText:'Original previous'}
  }
  const requests=[]
  await writeCvAdaptation({job,sourceCv:{cvId:'cv-1',sourceVersion:'sha256:cv1',fileName:'CV1.pdf',cvText},structure,updateFocus},async request=>{
    requests.push(request)
    return {
      professionalSummary:{tailoredText:'Updated summary',why:'Reason'},
      latestRoleOverview:{tailoredText:'Updated latest',why:'Reason'},
      previousRoleOverview:{tailoredText:'Updated previous',why:'Reason'}
    }
  })
  assert.equal(requests.length,1)
  assert.deepEqual(requests[0].input.updateFocus,updateFocus)
})

test('Best CV passes update focus only with the recommended CV selection',()=>{
  const source=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')
  assert.match(source,/cv\?\.id===analysis\?\.recommendedCvId/)
  assert.match(source,/analysis\?\.recommendation==='update_recommended'/)
  assert.match(source,/updateFocus:/)
})

test('tailor-cv forwards update focus into the one AI writer',()=>{
  const source=readFileSync(new URL('../api/tailor-cv/route.js',import.meta.url),'utf8')
  assert.match(source,/const updateFocus=Array\.isArray\(body\?\.updateFocus\)\?body\.updateFocus:\[\]/)
  assert.match(source,/writeCvAdaptation\(\{job,sourceCv,structure,updateFocus\}\)/)
})
