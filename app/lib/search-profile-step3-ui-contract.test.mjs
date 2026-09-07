import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Search Profile four-step flow keeps location and work-model normalization outside the current Step 3 exclusions screen',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

  assert.match(page,/normalizeSearchPreferences/)
  assert.match(page,/legacyGeographyFromPreferences/)
  assert.match(page,/const draftPreferences=normalizeSearchPreferences\(draft\)/)
  assert.match(page,/const draftLocations=draftPreferences\.locations/)
  assert.match(page,/const draftWorkModels=draftPreferences\.workModels/)
  assert.match(page,/const \{locations,workModels\}=normalizeSearchPreferences\(draft\)/)
  assert.match(page,/const geography=legacyGeographyFromPreferences\(locations,workModels\)/)
  assert.match(page,/locations,workModels,geography/)
  assert.match(page,/profileStep===3.*What should ApplyPilot exclude\?/s)
  assert.match(page,/profileStep===4.*Confirm your search profile/s)
  assert.doesNotMatch(page,/<SearchProfileLocationStep/)
})
