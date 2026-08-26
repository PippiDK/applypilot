import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const route=readFileSync(new URL('../api/best-cv/route.js',import.meta.url),'utf8')

test('Best CV API is protected and delegates only to the dedicated selector',()=>{
  assert.match(route,/requireUser/)
  assert.match(route,/analyzeBestCv/)
  assert.match(route,/cvs/)
  assert.match(route,/job/)
  assert.doesNotMatch(route,/searchLinkedIn|linkedin-search/)
  assert.doesNotMatch(route,/analyzeExpertiseMatch|expertise-match/)
})

test('Best CV API exposes safe AI failure categories without logging CV or JD payloads',()=>{
  assert.match(route,/AI_CONFIG_MISSING/)
  assert.match(route,/AI_PROVIDER_HTTP_401/)
  assert.match(route,/AI_PROVIDER_HTTP_429/)
  assert.match(route,/AI_PROVIDER_HTTP_400/)
  assert.match(route,/AI_PROVIDER_INCOMPLETE_MAX_OUTPUT_TOKENS/)
  const errorCalls=[...route.matchAll(/console\.error\(([^\n]+)\)/g)].map(match=>match[1])
  assert.ok(errorCalls.length>=1)
  for(const call of errorCalls) assert.doesNotMatch(call,/cvText|description|body|cvs/i)
})
