import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateJob} from './linkedin-search.js'

const TEST_RESUME=`Senior IT Project and Delivery Manager with enterprise software delivery, systems integration, governance, regulated financial IT, data platforms, Agile delivery, release and go-live experience across international teams.`

const BASE_JOB={
  title:'Senior IT Project Manager',
  description:`Lead end-to-end enterprise software and technology platform delivery. Own project scope, timelines, milestones, risks, dependencies, governance, senior stakeholders, systems integration, implementation, release readiness and go-live outcomes across international Agile teams.`,
  location:'Hørsholm, Capital Region of Denmark, Denmark',
  country:'Denmark',
  remoteType:'hybrid',
  remoteEligibility:'DENMARK CONFIRMED',
  fullJdVerified:true,
  vacancyStatus:'ACTIVE VIA THIRD PARTY',
}

function evaluateWithSalary({employmentType='permanent',salaryMinDkkMonth,salaryMaxDkkMonth}){
  return evaluateJob({...BASE_JOB,employmentType,salaryMinDkkMonth,salaryMaxDkkMonth},TEST_RESUME)
}

for(const employmentType of ['permanent','contract']){
  test(`salary is informational only for ${employmentType} Search evaluation`,()=>{
    const low=evaluateWithSalary({employmentType,salaryMinDkkMonth:50000,salaryMaxDkkMonth:55000})
    const high=evaluateWithSalary({employmentType,salaryMinDkkMonth:90000,salaryMaxDkkMonth:100000})

    assert.equal(low.score,high.score)
    assert.equal(low.verdict,high.verdict)
    assert.equal(low.action,high.action)
    assert.equal(low.breakdown.careerCompensation,high.breakdown.careerCompensation)
    assert.doesNotMatch([...low.match,...low.gaps,...high.match,...high.gaps].join(' '),/salary|compensation/i)
  })
}
