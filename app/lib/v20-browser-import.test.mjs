import test from 'node:test'
import assert from 'node:assert/strict'
import {parseBrowserExport,mergeBrowserJobs,normalizeBrowserRecord} from './v20-browser-import.js'
const record=(id='4479056497',extra={})=>({jobId:id,title:'IT Project Manager',company:'Example',url:`https://www.linkedin.com/jobs/view/${id}/`,fullJd:'A'.repeat(120),jdStatus:'complete',...extra})
test('collector two-page export maps distinct job IDs without title dedupe',()=>{
  const result=parseBrowserExport({schemaVersion:1,source:'linkedin-browser',pagesCollected:2,records:[record(),record('4479056498'),record()]})
  assert.equal(result.jobs.length,2)
  assert.equal(result.pagesCollected,2)
  assert.equal(result.jobs[0].jobId,'linkedin:4479056497')
  assert.equal(result.errors.length,0)
})
test('reject malicious URL mismatch and preserve valid rows',()=>{
  const result=parseBrowserExport({schemaVersion:1,source:'linkedin-browser',records:[record('4479056497',{url:'https://evil.example/jobs/view/4479056497/'}),record('4479056498')]})
  assert.equal(result.jobs.length,1)
  assert.equal(result.errors.length,1)
})
test('mark missing-fragment JD as review despite complete source flag',()=>{
  const job=normalizeBrowserRecord(record('4479056497',{fullJd:'A'.repeat(150)+' [remainder of source sentence missing]'}))
  assert.equal(job.jdStatus,'review')
})
test('merge keeps stronger JD and stable unique ids',()=>{
  const first=normalizeBrowserRecord(record('4479056497',{fullJd:'A'.repeat(130)}))
  const weak=normalizeBrowserRecord(record('4479056497',{fullJd:'short'}))
  assert.equal(mergeBrowserJobs([first],[weak])[0].fullJd.length,130)
})
test('reject malformed schema',()=>assert.throws(()=>parseBrowserExport({records:[]}),/supported/))

test('incomplete Trackunit JD stays imported, keeps its ID, and is marked for review',()=>{
  const raw=record('4475956666',{title:'Implementation Manager',company:'Trackunit',fullJd:'A'.repeat(170)+' geograph[remainder of source sentence missing].',jdStatus:'complete'})
  const result=parseBrowserExport({schemaVersion:1,source:'linkedin-browser',records:[raw]})
  assert.equal(result.jobs.length,1)
  assert.equal(result.errors.length,0)
  assert.equal(result.jobs[0].sourceJobId,'4475956666')
  assert.equal(result.jobs[0].needsJdReview,true)
  assert.equal(result.jobs[0].jdStatus,'review')
})
test('normalized v20 job is accepted again by validation for AI matching',()=>{
  const job=normalizeBrowserRecord(record('4475956665'))
  const normalized=normalizeBrowserRecord({...job,url:job.originalUrl})
  assert.equal(normalized.sourceJobId,'4475956665')
  assert.equal(normalized.jdStatus,'complete')
})

test('preserves verified ISO publication date and rejects unverified text',()=>{
 assert.equal(normalizeBrowserRecord(record('4479056497',{publishedAt:'2026-10-19T10:00:00.000Z'})).publishedAt,'2026-10-19T10:00:00.000Z')
 assert.equal(normalizeBrowserRecord(record('4479056498',{publishedAt:'3 days ago'})).publishedAt,null)
})

test('Collector day/hour dates are anchored to generatedAt rather than upload time',()=>{
 const payload={schemaVersion:1,source:'linkedin-browser',generatedAt:'2026-10-17T18:04:12.742Z',records:[
  record('4472008528',{publishedText:'Posted 7 hours ago'}),
  record('4470214346',{publishedText:'Posted 4 days ago'}),
  record('4470155451',{publishedText:'Posted 3 weeks ago'}),
  record('4470391406',{publishedText:null}),
 ]}
 const imported=parseBrowserExport(payload)
 assert.equal(imported.jobs.length,4)
 assert.equal(imported.jobs[0].publishedAt,'2026-10-17T11:04:12.742Z')
 assert.equal(imported.jobs[1].publishedAt,'2026-10-13T18:04:12.742Z')
 assert.equal(imported.jobs[2].publishedAt,null)
 assert.equal(imported.jobs[3].publishedAt,null)
})
test('No export generatedAt means relative date remains unknown',()=>{
 const payload={schemaVersion:1,source:'linkedin-browser',records:[record('4472008528',{publishedText:'Posted 1 day ago'})]}
 assert.equal(parseBrowserExport(payload).jobs[0].publishedAt,null)
})
