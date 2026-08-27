import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const discovery=fs.readFileSync(new URL('./linkedin-profile-discovery-batch.js',import.meta.url),'utf8')
const jdBatch=fs.readFileSync(new URL('./linkedin-profile-jd-batch.js',import.meta.url),'utf8')
const evaluator=fs.readFileSync(new URL('./linkedin-profile-evaluator.js',import.meta.url),'utf8')

test('this project preserves current Denmark discovery geography without adding geography logic',()=>{
  assert.match(discovery,/location:'Denmark'/)
  assert.doesNotMatch(discovery,/workModels|preferredLocations|distanceKm|EU\/EMEA.*location/)
})

test('profile Search remains independent from MATCH CV AND JD and CV tailoring modules',()=>{
  const source=`${jdBatch}\n${evaluator}`
  assert.doesNotMatch(source,/expertise-match|expertise-evaluator|best-cv|tailoring|tailor-cv/)
})
