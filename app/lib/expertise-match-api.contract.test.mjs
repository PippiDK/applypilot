import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const route=readFileSync(new URL('../api/expertise-match/route.js',import.meta.url),'utf8')

test('expertise-match API delegates JD interpretation and deterministic CV comparison to the expertise service',()=>{
  assert.match(route,/analyzeExpertiseMatch/)
  assert.match(route,/cvText/)
  assert.match(route,/job/)
  assert.doesNotMatch(route,/console\.log/)
})

test('expertise-match API does not modify or call LinkedIn search code',()=>{
  assert.doesNotMatch(route,/linkedin-search/)
  assert.doesNotMatch(route,/searchLinkedIn/)
})
