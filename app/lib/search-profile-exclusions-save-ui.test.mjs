import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('custom exclusions are compiled only on Save profile and then passed to profile-driven LIVE Search',()=>{
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
  assert.match(page,/JSON\.stringify\(\{freshnessDays,unionSearchPlan:profile\.unionSearchPlan,exclusionRules:Array\.isArray\(profile\.exclusionRules\)\?profile\.exclusionRules:\[\]\}\)/)
  assert.match(page,/JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
})

test('new unsaved profiles do not inherit another user’s exclusions',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(page,/EMPTY_SEARCH_PROFILE=\{\.\.\.DEFAULT_PROFILE,exclusions:''\}/)
  assert.match(page,/savedProfileRaw\?JSON\.parse\(savedProfileRaw\):\{exclusions:''\}/)
})
