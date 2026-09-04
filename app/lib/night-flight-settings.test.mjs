import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_NIGHT_FLIGHT_SETTINGS,
  normalizeNightFlightSettings,
  validateNightFlightSettings
} from './night-flight-settings.js'

test('defaults keep Night Flight disabled with all approved sources and no area restriction',()=>{
  assert.deepEqual(DEFAULT_NIGHT_FLIGHT_SETTINGS,{
    enabled:false,
    sources:['linkedin','jobindex','jobnet'],
    areas:[]
  })
})

test('normalizes a valid settings payload deterministically',()=>{
  assert.deepEqual(normalizeNightFlightSettings({
    enabled:true,
    sources:['jobnet','linkedin','linkedin'],
    areas:['north_zealand','greater_copenhagen','north_zealand']
  }),{
    enabled:true,
    sources:['linkedin','jobnet'],
    areas:['greater_copenhagen','north_zealand']
  })
})

test('rejects unsupported sources and empty source selection',()=>{
  assert.throws(()=>validateNightFlightSettings({enabled:true,sources:['indeed'],areas:[]}),/Unsupported Night Flight source/)
  assert.throws(()=>validateNightFlightSettings({enabled:true,sources:[],areas:[]}),/At least one Night Flight source/)
})

test('rejects unsupported areas and non-object payloads',()=>{
  assert.throws(()=>validateNightFlightSettings({enabled:true,sources:['linkedin'],areas:['moon']}),/Unsupported Night Flight area/)
  assert.throws(()=>validateNightFlightSettings(null),/Night Flight settings payload must be an object/)
})
