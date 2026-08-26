import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Search Profile Step 3 separates location from work model',()=>{
  const component=fs.readFileSync(new URL('../components/search-profile-location-step.js',import.meta.url),'utf8')
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

  assert.match(component,/WHERE/)
  assert.match(component,/WORK MODEL/)
  assert.match(component,/Denmark/)
  assert.match(component,/EU \/ EMEA/)
  assert.match(component,/Worldwide/)
  assert.match(component,/Hybrid/)
  assert.match(component,/On-site/)
  assert.match(component,/Remote/)

  assert.match(page,/normalizeSearchPreferences/)
  assert.match(page,/legacyGeographyFromPreferences/)
  assert.match(page,/<SearchProfileLocationStep/)
  assert.match(page,/const \{locations,workModels\}=normalizeSearchPreferences\(draft\)/)
  assert.match(page,/locations,workModels,geography/)
  assert.match(page,/cvText:cvData\.cvText/)
})
