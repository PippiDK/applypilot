import test from 'node:test'
import assert from 'node:assert/strict'

async function loadModule(){
  try{return await import('./night-flight-morning-review-errors.js')}catch{return {}}
}

test('Morning Review renders identical saved and recovery failures once',async()=>{
  const {nightFlightFailureMessages}=await loadModule()
  assert.equal(typeof nightFlightFailureMessages,'function')
  assert.deepEqual(nightFlightFailureMessages('same failure','same failure'),['same failure'])
})

test('Morning Review keeps distinct saved and recovery failures visible',async()=>{
  const {nightFlightFailureMessages}=await loadModule()
  assert.equal(typeof nightFlightFailureMessages,'function')
  assert.deepEqual(nightFlightFailureMessages('saved failure','new failure'),['saved failure','new failure'])
})
