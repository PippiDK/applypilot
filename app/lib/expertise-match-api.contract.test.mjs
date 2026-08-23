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

test('expertise-match API surfaces only safe actionable AI failure categories',()=>{
  assert.match(route,/AI_CONFIG_MISSING/)
  assert.match(route,/AI_PROVIDER_HTTP_401/)
  assert.match(route,/AI_PROVIDER_HTTP_429/)
  assert.match(route,/AI_PROVIDER_HTTP_400/)
  assert.match(route,/AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS/)
  assert.match(route,/console\.error/)
  const errorCalls=[...route.matchAll(/console\.error\(([^\n]+)\)/g)].map(match=>match[1])
  assert.ok(errorCalls.length>=1)
  for(const call of errorCalls){ assert.doesNotMatch(call,/cvText|job|description|body/i) }
})
