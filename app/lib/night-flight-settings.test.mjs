import test from 'node:test'
import assert from 'node:assert/strict'

async function loadSettingsModule(){
  try{return await import('./night-flight-settings.js')}catch{return null}
}

test('Night Flight settings default to OFF, all three sources and all areas',async()=>{
  const mod=await loadSettingsModule()
  assert.ok(mod,'night-flight-settings.js must exist')
  assert.deepEqual(mod.DEFAULT_NIGHT_FLIGHT_SETTINGS,{
    enabled:false,
    sources:['linkedin','jobindex','jobnet'],
    areas:[],
  })
  assert.deepEqual(mod.normalizeNightFlightSettings(null),mod.DEFAULT_NIGHT_FLIGHT_SETTINGS)
})

test('Night Flight settings reject zero sources and unknown values',async()=>{
  const mod=await loadSettingsModule()
  assert.ok(mod,'night-flight-settings.js must exist')
  assert.throws(()=>mod.validateNightFlightSettings({enabled:true,sources:[],areas:[]}),/Select at least one source\./)
  assert.throws(()=>mod.validateNightFlightSettings({enabled:true,sources:['linkedin','other'],areas:[]}),/Unknown Night Flight source/)
  assert.throws(()=>mod.validateNightFlightSettings({enabled:true,sources:['linkedin'],areas:['moon']}),/Unknown Night Flight area/)
})

test('Night Flight settings keep zero areas as valid Match ALL semantics',async()=>{
  const mod=await loadSettingsModule()
  assert.ok(mod,'night-flight-settings.js must exist')
  const result=mod.validateNightFlightSettings({enabled:true,sources:['linkedin'],areas:[]})
  assert.deepEqual(result,{enabled:true,sources:['linkedin'],areas:[]})
})
