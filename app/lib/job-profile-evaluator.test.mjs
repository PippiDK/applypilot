import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateProfileJob } from './job-profile-evaluator.js'

const NOW=new Date('2026-08-30T12:00:00Z')

function baseJob(overrides={}){
  return {
    title:'Senior Project Manager',
    company:'Acme A/S',
    location:'Copenhagen, Denmark',
    country:'Denmark',
    description:'Lead project delivery across technology teams and stakeholders.',
    publishedAt:'2026-08-30T08:00:00Z',
    vacancyStatus:'OPEN',
    employmentType:'Full-time',
    remoteType:'Hybrid',
    ...overrides,
  }
}

const primary=[{role:'Senior Project Manager',tier:'primary'}]
const currentProfile=[
  {role:'Senior IT Project Manager',tier:'primary'},
  {role:'Technical Project Manager',tier:'adjacent'},
]

test('preserves current exact primary role score and verdict',()=>{
  const result=evaluateProfileJob({job:baseJob(),foundBy:primary,exclusionRules:[],freshnessDays:7,now:NOW})
  assert.equal(result.pass,true)
  assert.equal(result.stage,'KEPT')
  assert.equal(result.evaluation.score,9.6)
  assert.equal(result.evaluation.verdict,'Strong profile match')
  assert.equal(result.evaluation.action,'Consider')
  assert.equal(result.reason,'Matched primary Search Profile direction: Senior Project Manager')
})

test('rejects a vacancy outside freshness before role evaluation',()=>{
  const result=evaluateProfileJob({job:baseJob({publishedAt:'2026-08-20T08:00:00Z'}),foundBy:primary,exclusionRules:[],freshnessDays:7,now:NOW})
  assert.equal(result.pass,false)
  assert.equal(result.stage,'FRESHNESS_REJECT')
  assert.equal(result.reason,'Vacancy is outside the selected 7-day window')
})

test('preserves deterministic Search Profile exclusion behavior',()=>{
  const result=evaluateProfileJob({
    job:baseJob({company:'Blocked Company'}),
    foundBy:primary,
    freshnessDays:7,
    now:NOW,
    exclusionRules:[{evaluation:'deterministic',operator:'exclude',category:'company',value:'Blocked Company',originalText:'Exclude Blocked Company'}],
  })
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_EXCLUSION_REJECT')
  assert.equal(result.reason,'Search Profile exclusion: Exclude Blocked Company')
})

test('rejects a role outside approved Search Profile directions',()=>{
  const result=evaluateProfileJob({job:baseJob({title:'Finance Controller',description:'Own month-end reporting and financial controls.'}),foundBy:primary,exclusionRules:[],freshnessDays:7,now:NOW})
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_ROLE_REJECT')
  assert.equal(result.reason,'Vacancy does not confirm an approved Search Profile role direction')
})

test('keeps Danish projectleder for explicit IT projects as Senior IT Project Manager',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'Erfaren projektleder til større, samfundskritiske it-projekter',
      description:'Du leder store it-projekter med systemer, leverandører, risici, implementering og forretningsinteressenter.',
    }),
    foundBy:[{role:'Senior IT Project Manager',tier:'primary'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.stage,'KEPT')
  assert.equal(result.evaluation.breakdown.roleDirection,'Senior IT Project Manager')
})

test('rejects generic shipyard Project Manager even when discovered by IT and Technical Project Manager directions',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'Project Manager',
      company:'FAYARD A/S',
      description:'Plan and execute ship repair projects, docking schedules, steel work, marine subcontractors, vessel owners, budgets and yard operations.',
    }),
    foundBy:currentProfile,freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_ROLE_REJECT')
})

test('rejects offshore wind component Project Manager without digital technology context',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'Project Manager - Main Component Exchanges (f/m/d)',
      company:'Semco Maritime A/S',
      description:'Lead offshore wind main component exchange campaigns covering vessels, cranes, HSEQ, marine logistics, technicians and subcontractors.',
    }),
    foundBy:currentProfile,freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,false)
  assert.equal(result.stage,'PROFILE_ROLE_REJECT')
})

test('keeps generic Project Manager when full JD clearly confirms IT project context',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'Project Manager',
      description:'Lead enterprise IT projects across software platforms, systems integration, vendors, migration, delivery risks and business stakeholders.',
    }),
    foundBy:[{role:'Senior IT Project Manager',tier:'primary'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.stage,'KEPT')
  assert.ok(result.evaluation.score>=7.5)
})

test('keeps technology-context strategic innovation Project Manager as adjacent Technical Project Manager',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'Project Manager - Strategic Innovation – DTU Link',
      description:'Drive technology innovation projects involving digital solutions, research teams, technical systems, commercialization and external stakeholders.',
    }),
    foundBy:currentProfile,freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.stage,'KEPT')
  assert.equal(result.evaluation.breakdown.roleDirection,'Technical Project Manager')
})

test('keeps Digital Transformation Manager when digital transformation is explicit',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'AI Business Transformation Manager',
      description:'Lead digital transformation and AI adoption across business processes, technology teams, data platforms and change initiatives.',
    }),
    foundBy:[{role:'Digital Transformation Manager',tier:'adjacent'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.stage,'KEPT')
})

test('does not rate a generic Project Manager title as a strong Senior IT Project Manager even when JD confirms IT context',()=>{
  const result=evaluateProfileJob({
    job:baseJob({
      title:'Project Manager',
      description:'Lead enterprise IT projects across software platforms, systems integration, vendors and migrations.',
    }),
    foundBy:[{role:'Senior IT Project Manager',tier:'primary'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.ok(result.evaluation.score>=7.5)
  assert.ok(result.evaluation.score<9)
})

test('keeps exact Senior Delivery Manager broad because that approved direction has no IT anchor',()=>{
  const result=evaluateProfileJob({
    job:baseJob({title:'Senior Delivery Manager',description:'Own complex service delivery, stakeholders, risks, suppliers and operational improvements.'}),
    foundBy:[{role:'Senior Delivery Manager',tier:'primary'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.evaluation.breakdown.roleDirection,'Senior Delivery Manager')
})

test('keeps Technology Implementation Manager when both technology and implementation are confirmed',()=>{
  const result=evaluateProfileJob({
    job:baseJob({title:'Implementation Manager',description:'Lead implementation of enterprise software platforms, data integrations, rollout planning, migration and go-live.'}),
    foundBy:[{role:'Technology Implementation Manager',tier:'primary'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.evaluation.breakdown.roleDirection,'Technology Implementation Manager')
})

test('keeps exact PMO Manager direction',()=>{
  const result=evaluateProfileJob({
    job:baseJob({title:'PMO Manager',description:'Lead PMO governance, portfolio reporting, project controls, risks and executive steering.'}),
    foundBy:[{role:'PMO Manager',tier:'adjacent'}],freshnessDays:7,now:NOW,
  })
  assert.equal(result.pass,true)
  assert.equal(result.evaluation.breakdown.roleDirection,'PMO Manager')
})
