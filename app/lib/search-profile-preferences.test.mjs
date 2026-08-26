import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSearchPreferences,legacyGeographyFromPreferences} from './search-profile-preferences.js'

test('migrates legacy geography into separate locations and work models',()=>{
  const result=normalizeSearchPreferences({geography:['Denmark hybrid','Remote EU/EMEA']})
  assert.deepEqual(result.locations,['Denmark','EU/EMEA'])
  assert.deepEqual(result.workModels,['hybrid','remote'])
})

test('preserves explicit structured preferences',()=>{
  const result=normalizeSearchPreferences({locations:['Denmark','Worldwide'],workModels:['onsite','remote'],geography:['ignored legacy']})
  assert.deepEqual(result.locations,['Denmark','Worldwide'])
  assert.deepEqual(result.workModels,['onsite','remote'])
})

test('builds a backward-compatible geography array for current consumers',()=>{
  assert.deepEqual(
    legacyGeographyFromPreferences(['Denmark','EU/EMEA'],['hybrid','remote']),
    ['Denmark','EU/EMEA','hybrid','remote']
  )
})
