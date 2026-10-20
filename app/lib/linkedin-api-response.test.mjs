import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {readLinkedInApiJson} from './linkedin-api-response.js'

test('reproduces the LIVE symptom: gateway returns text beginning with A server error',async()=>{
  const response=new Response('A server error has occurred',{status:500,headers:{'Content-Type':'text/plain'}})
  await assert.rejects(readLinkedInApiJson(response,{phase:'LinkedIn detail batch'}),/LinkedIn detail batch: HTTP 500; server returned a non-JSON error response/)
})
test('reports request-size failures without leaking gateway response text',async()=>{
  const response=new Response('<html>Gateway refused body</html>',{status:413,headers:{'Content-Type':'text/html'}})
  await assert.rejects(readLinkedInApiJson(response),/HTTP 413; request exceeded the server size limit/)
})
test('passes successful JSON responses through unchanged',async()=>{
  const result={jobs:[{job:{sourceJobId:'111'}}],stats:{detailComplete:false,detailNextStart:10},coverage:{status:'SEARCHED'}}
  assert.deepEqual(await readLinkedInApiJson(Response.json(result)),result)
})
test('retains structured application errors with HTTP status',async()=>{
  const response=Response.json({error:'Search Profile is not configured.'},{status:400})
  await assert.rejects(readLinkedInApiJson(response,{phase:'LinkedIn discovery'}),/LinkedIn discovery: HTTP 400; Search Profile is not configured/)
})
test('rejects malformed JSON even when HTTP status is 200',async()=>{
  const response=new Response('A server error has occurred',{status:200})
  await assert.rejects(readLinkedInApiJson(response),/HTTP 200; response was not valid JSON/)
})
test('rejects primitive JSON rather than continuing with an empty batch',async()=>{
  const response=new Response('"ok"',{status:200})
  await assert.rejects(readLinkedInApiJson(response),/unexpected JSON response/)
})
test('the actual LinkedIn continuation and recovery paths use guarded reads and report partial coverage',()=>{
  const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  assert.match(main,/data=await readLinkedInApiJson\(res,\{phase:continuation\?'LinkedIn detail batch':'LinkedIn discovery'\}\)/)
  assert.match(main,/recoveryData=await readLinkedInApiJson\(res,\{phase:'LinkedIn recovery batch'\}\)/)
  assert.match(main,/interruptedLinkedInError=error/)
  assert.match(main,/Saved partial results are retained/)
  assert.match(main,/detailComplete:!interruptedLinkedInError/)
  assert.match(main,/detail:failed\[0\]\?\.reason\?\.message\|\|successful\.map/)
})
