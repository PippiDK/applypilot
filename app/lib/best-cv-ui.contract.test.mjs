import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('right panel exposes manual Best CV flow above Expertise Match without a Best CV percentage',()=>{
  const best=page.indexOf('BEST CV FOR THIS JOB')
  const expertise=page.indexOf('EXPERTISE MATCH')
  assert.ok(best>=0,'Best CV section is missing')
  assert.ok(expertise>best,'Best CV section must render above Expertise Match')
  assert.match(page,/Find best CV/)
  assert.match(page,/runBestCv/)
  assert.match(page,/requestBestCv/)
  assert.match(page,/readBestCvCache/)
  assert.match(page,/writeBestCvCache/)
  assert.doesNotMatch(page,/bestCv[^\n]{0,80}%/i)
})

test('Best CV result renders one existing CV, advice, ranking and explicit use action',()=>{
  assert.match(page,/recommendedCvId/)
  assert.match(page,/USE AS IS/)
  assert.match(page,/UPDATE RECOMMENDED/)
  assert.match(page,/updateFocus/)
  assert.match(page,/rankedCvIds/)
  assert.match(page,/Use this CV/)
  assert.match(page,/Selected for this job/)
})

test('Best CV action does not automatically run Expertise Match or LinkedIn Search',()=>{
  const start=page.indexOf('async function runBestCv')
  const end=page.indexOf('async function runExpertiseMatch')
  assert.ok(start>=0&&end>start)
  const handler=page.slice(start,end)
  assert.doesNotMatch(handler,/requestExpertiseMatch|runExpertiseMatch/)
  assert.doesNotMatch(handler,/searchLinkedIn|linkedin-search/)
})
