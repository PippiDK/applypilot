import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('custom exclusions are processed only by Save profile and Search stays disconnected',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(page,/requestSearchProfileExclusions/)
  assert.match(page,/resolveSearchProfileExclusions/)
  assert.match(page,/async function saveProfile\(\)/)
  assert.match(page,/parse:requestSearchProfileExclusions/)
  assert.match(page,/exclusionRules:compiledExclusions\.rules/)
  assert.match(page,/exclusionsFingerprint:compiledExclusions\.fingerprint/)
  assert.match(page,/exclusionsParserVersion:compiledExclusions\.parserVersion/)
  assert.match(page,/Saving profile…/)
  assert.doesNotMatch(page,/onChange=\{[^}]*requestSearchProfileExclusions/s)
  assert.match(page,/body:JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
  assert.doesNotMatch(page,/JSON\.stringify\(\{freshnessDays[^}]*exclusionRules/s)
})

test('new unsaved profiles do not inherit another user’s exclusions',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(page,/EMPTY_SEARCH_PROFILE=\{\.\.\.DEFAULT_PROFILE,exclusions:''\}/)
  assert.match(page,/savedProfileRaw\?JSON\.parse\(savedProfileRaw\):\{exclusions:''\}/)
})
