import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const rolesStep=fs.readFileSync(new URL('../components/search-profile-roles-step.js',import.meta.url),'utf8')

test('Search Profile role step is library-aware rather than CV1-only',()=>{
  assert.doesNotMatch(rolesStep,/Generated from CV 1|proposes credible target roles from CV 1|Analysing CV 1/)
  assert.match(rolesStep,/Generated from .*CV/)
})

test('page builds Search Profile roles from ready CV library entries',()=>{
  assert.match(page,/searchProfileLibraryFingerprint/)
  assert.match(page,/buildCvRoleProfile/)
  assert.match(page,/combineCvRoleProfiles/)
  assert.match(page,/cvRoleProfiles/)
})

test('LinkedIn Search request remains CV1 payload during Step 1',()=>{
  assert.match(page,/JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
})
