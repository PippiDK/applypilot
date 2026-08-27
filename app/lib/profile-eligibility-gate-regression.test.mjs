import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateProfileJob} from './linkedin-profile-evaluator.js'

const NOW=new Date('2026-08-27T12:00:00Z')

function job(title,description,{company='Example Co',location='Denmark'}={}){
  return {
    title,
    description,
    company,
    location,
    publishedAt:'2026-08-27T08:00:00Z',
    vacancyStatus:'OPEN',
    employmentType:'FULL_TIME',
    remoteType:'HYBRID',
  }
}

function evaluate({candidate,job:vacancy,exclusionRules=[]}){
  return evaluateProfileJob({candidate,job:vacancy,freshnessDays:7,exclusionRules,now:NOW})
}

const keepCases=[
  {
    name:'Ambu Senior IT Project Manager',
    candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    vacancy:job('Senior IT Project Manager','Lead enterprise IT platform and software delivery across systems, integrations, APIs, cloud services and go-live.'),
  },
  {
    name:'Atea Danish IT project manager',
    candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    vacancy:job('Senior IT-projektledere med teknisk indsigt','Drive IT-projekter, digitale løsninger, IT-systemer, integrationer, platforme og tekniske leverancer.'),
  },
  {
    name:'PET strategic IT projects',
    candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    vacancy:job('Kan du drive succesfulde strategiske IT projekter i PET?','Drive komplekse IT projekter, digitale systemer, platforme, integrationer og leverancer på tværs af tekniske teams.'),
  },
  {
    name:'Annapurna integration PM',
    candidate:{foundBy:[{role:'Integration Project Manager',tier:'adjacent'}]},
    vacancy:job('Integration Project Manager','Lead API, middleware, system integration and enterprise application delivery across cloud platforms.'),
  },
  {
    name:'Twoday data platform modernisation',
    candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    vacancy:job('Senior Project Manager – Data Platform Modernisation','Lead cloud data platform, analytics, data migration, integrations and technology delivery.'),
  },
  {
    name:'Regionshospitalet digitalisation',
    candidate:{foundBy:[{role:'Digital Transformation Manager',tier:'primary'}]},
    vacancy:job('Erfaren projektleder søges til kliniknær digitalisering','Drive digitalisering, digitale løsninger, IT-systemer, integrationer og implementation across clinical teams.'),
  },
]

for(const fixture of keepCases){
  test(`${fixture.name} remains KEEP`,()=>{
    const result=evaluate({candidate:fixture.candidate,job:fixture.vacancy})
    assert.equal(result.keep,true)
    assert.equal(result.decision,'KEEP')
    assert.equal(result.stage,'KEPT')
    assert.ok(result.score>0)
  })
}

test('roads and highways project manager becomes a physical-domain reject',()=>{
  const result=evaluate({
    candidate:{foundBy:[{role:'Enterprise Project Manager',tier:'primary'}]},
    job:job('Senior Project Manager - Roads and Highways','Lead road design, highways, civil engineering, construction, contractors and site delivery.'),
  })
  assert.equal(result.keep,false)
  assert.equal(result.decision,'REJECT')
  assert.equal(result.stage,'PROFILE_DOMAIN_REJECT')
})

test('mechanical construction data-centre PM is rejected despite incidental technology evidence',()=>{
  const result=evaluate({
    candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    job:job('Senior Mechanical Construction Project Manager - Data Centres','Own mechanical construction, site works, contractors, HVAC and installation for data centres. Coordinate BMS, SCADA, OT systems and technical integrations during commissioning.'),
  })
  assert.equal(result.keep,false)
  assert.equal(result.decision,'REJECT')
  assert.equal(result.stage,'PROFILE_DOMAIN_REJECT')
})

test('finance-only project manager is rejected despite incidental systems evidence',()=>{
  const result=evaluate({
    candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},
    job:job('Senior Finance Project Manager','Lead accounting, controlling, month-end and finance-process transformation. Coordinate SAP finance systems, reporting data platform and automation with IT teams, while owning the finance workstream.'),
  })
  assert.equal(result.keep,false)
  assert.equal(result.decision,'REJECT')
  assert.equal(result.stage,'PROFILE_DOMAIN_REJECT')
})

test('Regulatory Affairs Specialist cannot match Regulatory Project Manager direction',()=>{
  const result=evaluate({
    candidate:{foundBy:[{role:'Regulatory Project Manager',tier:'adjacent'}]},
    job:job('Regulatory Affairs Specialist','Prepare regulatory submissions, compliance documentation and authority correspondence. Support regulatory projects and maintain product registrations as a subject-matter specialist.'),
  })
  assert.equal(result.keep,false)
  assert.equal(result.decision,'REJECT')
  assert.equal(result.stage,'PROFILE_ROLE_FAMILY_REJECT')
})

const erpRules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'ERP specialist roles',originalText:'ERP specialist roles'}]
const rndRules=[{evaluation:'deterministic',operator:'exclude',category:'domain',value:'R&D roles',originalText:'R&D roles'}]

const sapJob=job('SAP S/4HANA Public Cloud Finance Project Manager','Lead SAP S/4HANA public-cloud ERP finance implementation, configuration, integrations, data migration and finance transformation.')
const rndJob=job('Senior Project Manager, Global R&D, Respiratory & ENT','Lead global research and development projects for medical-device product development, design controls and R&D systems across engineering teams.')

test('user ERP-specialist exclusion semantically rejects SAP ERP PM',()=>{
  const result=evaluate({candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},job:sapJob,exclusionRules:erpRules})
  assert.equal(result.keep,false)
  assert.equal(result.decision,'REJECT')
  assert.equal(result.stage,'PROFILE_EXCLUSION_REJECT')
})

test('ERP semantic exclusion is not invented when the user did not configure it',()=>{
  const result=evaluate({candidate:{foundBy:[{role:'Senior IT Project Manager',tier:'primary'}]},job:sapJob,exclusionRules:[]})
  assert.notEqual(result.stage,'PROFILE_EXCLUSION_REJECT')
})

test('user R&D exclusion semantically rejects an R&D project manager',()=>{
  const result=evaluate({candidate:{foundBy:[{role:'Enterprise Project Manager',tier:'primary'}]},job:rndJob,exclusionRules:rndRules})
  assert.equal(result.keep,false)
  assert.equal(result.decision,'REJECT')
  assert.equal(result.stage,'PROFILE_EXCLUSION_REJECT')
})

test('R&D semantic exclusion is not invented when the user did not configure it',()=>{
  const result=evaluate({candidate:{foundBy:[{role:'Enterprise Project Manager',tier:'primary'}]},job:rndJob,exclusionRules:[]})
  assert.notEqual(result.stage,'PROFILE_EXCLUSION_REJECT')
})

test('generic project manager with unknown delivery domain becomes HOLD',()=>{
  const result=evaluate({
    candidate:{foundBy:[{role:'Enterprise Project Manager',tier:'primary'}]},
    job:job('Senior Project Manager','Lead complex cross-functional initiatives, stakeholders, plans, risks, milestones, dependencies and delivery.'),
  })
  assert.equal(result.keep,false)
  assert.equal(result.decision,'HOLD')
  assert.equal(result.stage,'PROFILE_DOMAIN_AMBIGUOUS')
  assert.equal(result.score,null)
})
