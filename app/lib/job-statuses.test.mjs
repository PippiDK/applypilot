import test from 'node:test'
import assert from 'node:assert/strict'

const load=()=>import('./job-statuses.js')

test('Night Flight is a derived status, not a manual persisted option',async()=>{
  const mod=await load()
  assert.equal(typeof mod.resolveJobStatus,'function')
  assert.equal(mod.JOB_STATUS_OPTIONS.some(option=>option.value==='night-flight'),false)
})

test('manual user statuses override the derived Night Flight state',async()=>{
  const {resolveJobStatus}=await load()
  const job={nightFlight:{processed:true}}
  assert.equal(resolveJobStatus({manualStatus:'applied',job}),'applied')
  assert.equal(resolveJobStatus({manualStatus:'considering',job}),'considering')
  assert.equal(resolveJobStatus({manualStatus:'ignore',job}),'ignore')
})

test('Night Flight appears when no manual status exists and returns after manual status is cleared',async()=>{
  const {resolveJobStatus}=await load()
  const job={nightFlight:{processed:true}}
  assert.equal(resolveJobStatus({manualStatus:'',job}),'night-flight')
  assert.equal(resolveJobStatus({manualStatus:null,job}),'night-flight')
})

test('ordinary jobs keep STATUS when no manual status exists',async()=>{
  const {resolveJobStatus}=await load()
  assert.equal(resolveJobStatus({manualStatus:'',job:{}}),'')
})
