import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateExpertise } from './expertise-match.js'
import { evaluateJobConditions } from './job-conditions.js'

const cv=`Senior IT Project and Delivery Manager. Led end-to-end enterprise software delivery, governance, risk and dependency management, executive stakeholder reporting, Data Warehouse and BI initiatives across regulated environments. `.repeat(3)

const requirements=[
  {id:'r1',capability:'End-to-end delivery',category:'delivery_execution',importance:'critical',requirement:'Lead end-to-end delivery',minimumYears:0,directEvidenceTerms:['end-to-end'],transferableEvidenceTerms:[],jdEvidence:'Lead end-to-end delivery'},
  {id:'r2',capability:'Executive stakeholder leadership',category:'leadership_stakeholder_scope',importance:'core',requirement:'Partner with senior executives',minimumYears:0,directEvidenceTerms:['executive stakeholder'],transferableEvidenceTerms:['stakeholder reporting'],jdEvidence:'Partner with senior executives'},
  {id:'r3',capability:'AI Product Management',category:'domain_functional_expertise',importance:'critical',requirement:'AI Product Management experience',minimumYears:0,directEvidenceTerms:['AI Product Management'],transferableEvidenceTerms:['Data Warehouse','BI'],jdEvidence:'AI Product Management experience'},
]

test('job conditions never alter Expertise Match',()=>{
  const before=evaluateExpertise(requirements,cv)

  const preferredJob={location:'Ballerup',salaryMinDkkMonth:85000,salaryMaxDkkMonth:100000,employmentType:'permanent',remoteType:'hybrid'}
  const moonJob={location:'Moon',salaryMinDkkMonth:1,salaryMaxDkkMonth:2,employmentType:'contract',remoteType:'onsite'}
  const profile={preferredLocations:'Ballerup',salary:'75000',acceptedEmploymentTypes:['permanent'],acceptedWorkModels:['hybrid']}

  const preferred=evaluateJobConditions(preferredJob,profile)
  const different=evaluateJobConditions(moonJob,profile)
  const after=evaluateExpertise(requirements,cv)

  assert.notDeepEqual(preferred,different)
  assert.equal(after.expertiseMatch,before.expertiseMatch)
  assert.deepEqual(after.breakdown,before.breakdown)
})
