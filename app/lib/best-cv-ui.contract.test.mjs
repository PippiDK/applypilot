import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const component=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')

test('right panel mounts isolated Best CV flow above Expertise Match',()=>{
  assert.match(page,/import BestCvPanel/)
  const best=page.indexOf('<BestCvPanel')
  const expertise=page.indexOf('EXPERTISE MATCH')
  assert.ok(best>=0,'Best CV panel is missing')
  assert.ok(expertise>best,'Best CV panel must render above Expertise Match')
})

test('Best CV component is manual, cached and has no Best CV percentage',()=>{
  assert.match(component,/BEST CV FOR THIS JOB/)
  assert.match(component,/Find best CV/)
  assert.match(component,/runBestCv/)
  assert.match(component,/requestBestCv/)
  assert.match(component,/readBestCvCache/)
  assert.match(component,/writeBestCvCache/)
  assert.doesNotMatch(component,/bestCv[^\n]{0,80}%/i)
})

test('Best CV result is recommendation-only with advice, ranking and no selection action',()=>{
  assert.match(component,/recommendedCvId/)
  assert.match(component,/USE AS IS/)
  assert.match(component,/UPDATE RECOMMENDED/)
  assert.match(component,/updateFocus/)
  assert.match(component,/rankedCvIds/)
  assert.doesNotMatch(component,/Use this CV|Selected for this job/)
  assert.doesNotMatch(component,/readBestCvSelection|writeBestCvSelection|selectedCvId|useRecommendedCv/)
})

test('Best CV component cannot call Expertise Match or LinkedIn Search',()=>{
  assert.doesNotMatch(component,/requestExpertiseMatch|runExpertiseMatch/)
  assert.doesNotMatch(component,/searchLinkedIn|linkedin-search/)
})
