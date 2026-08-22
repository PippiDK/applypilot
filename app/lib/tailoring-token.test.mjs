import test from 'node:test'
import assert from 'node:assert/strict'

async function load(){ return import('./tailoring-token.js').catch(()=>({})) }

const secret='unit-test-secret-at-least-32-characters'
const now=Date.parse('2026-08-22T18:00:00Z')
const payload={stage:'job_analyzed',sourceVersion:'sha256:abc',jobHash:'sha256:def',analysis:{roleMission:'Deliver transformation'}}

test('signs and verifies an intact short-lived tailoring token',async()=>{
  const {signTailoringToken,verifyTailoringToken}=await load()
  assert.equal(typeof signTailoringToken,'function')
  assert.equal(typeof verifyTailoringToken,'function')
  const token=signTailoringToken(payload,secret,now)
  const verified=verifyTailoringToken(token,secret,now+30_000)
  assert.equal(verified.stage,'job_analyzed')
  assert.equal(verified.sourceVersion,'sha256:abc')
})

test('rejects a modified signed token',async()=>{
  const {signTailoringToken,verifyTailoringToken}=await load()
  assert.equal(typeof signTailoringToken,'function')
  assert.equal(typeof verifyTailoringToken,'function')
  const token=signTailoringToken(payload,secret,now)
  const [body,sig]=token.split('.')
  const decoded=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))
  decoded.sourceVersion='sha256:tampered'
  const modified=`${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${sig}`
  assert.throws(()=>verifyTailoringToken(modified,secret,now+30_000),/invalid tailoring token/i)
})

test('rejects an expired tailoring token',async()=>{
  const {signTailoringToken,verifyTailoringToken}=await load()
  assert.equal(typeof signTailoringToken,'function')
  assert.equal(typeof verifyTailoringToken,'function')
  const token=signTailoringToken(payload,secret,now,{ttlMs:60_000})
  assert.throws(()=>verifyTailoringToken(token,secret,now+60_001),/expired/i)
})
