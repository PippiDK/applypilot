import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateJobConditions} from './job-conditions.js'

const job={
  location:'Ballerup Municipality, Capital Region of Denmark, Denmark',
  salaryMinDkkMonth:70583,
  salaryMaxDkkMonth:103758,
  employmentType:'permanent',
  remoteType:'hybrid'
}

test('Area is scored only against explicit preferred locations',()=>{
  const result=evaluateJobConditions(job,{preferredLocations:'Nærum, Hørsholm, Ballerup, Lyngby'})
  assert.deepEqual(result.area,{score:100,value:job.location})
  const moon=evaluateJobConditions({...job,location:'Moon'}, {preferredLocations:'Nærum, Hørsholm, Ballerup, Lyngby'})
  assert.equal(moon.area.score,0)
})

test('Salary is informational/preference-based and missing salary returns N/A rather than zero',()=>{
  const result=evaluateJobConditions(job,{salary:'75000'})
  assert.equal(result.salary.score,50)
  assert.match(result.salary.value,/70\.583–103\.758 DKK\/month/)
  const missing=evaluateJobConditions({...job,salaryMinDkkMonth:null,salaryMaxDkkMonth:null},{salary:'75000'})
  assert.equal(missing.salary.score,null)
  assert.equal(missing.salary.value,'Not stated')
})

test('Employment and work-model scores are N/A until explicit preferences exist',()=>{
  const result=evaluateJobConditions(job,{})
  assert.deepEqual(result.employmentType,{score:null,value:'Permanent'})
  assert.deepEqual(result.workModel,{score:null,value:'Hybrid'})
})

test('Employment and work-model become deterministic binary preference matches when explicit preferences are supplied',()=>{
  const result=evaluateJobConditions(job,{acceptedEmploymentTypes:['permanent','contract'],acceptedWorkModels:['hybrid','remote']})
  assert.equal(result.employmentType.score,100)
  assert.equal(result.workModel.score,100)
  const onsite=evaluateJobConditions({...job,remoteType:'onsite'},{acceptedEmploymentTypes:['permanent'],acceptedWorkModels:['hybrid','remote']})
  assert.equal(onsite.workModel.score,0)
})
