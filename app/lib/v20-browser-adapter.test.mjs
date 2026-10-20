import test from 'node:test'
import assert from 'node:assert/strict'
import {collectorRecordToApplyPilotJob,collectorJobsToApplyPilotJobs} from './v20-browser-adapter.js'
const job=(id='4475956666',more={})=>({jobId:id,title:'Implementation Manager',company:'Trackunit',location:'Copenhagen, Denmark (Hybrid)',fullJd:'A'.repeat(160),url:`https://www.linkedin.com/jobs/view/${id}/`,publishedText:'Promoted',jdStatus:'complete',...more})

test('adapts collector row without inventing score or publication date',()=>{
  const value=collectorRecordToApplyPilotJob(job())
  assert.equal(value.source,'linkedin')
  assert.equal(value.importLabel,'LinkedIn Import')
  assert.equal(value.sourceJobId,'4475956666')
  assert.equal(value.remoteType,'hybrid')
  assert.equal(value.publishedAt,null)
  assert.equal(value.evaluation,undefined)
  assert.equal(value.sourceRecords[0].fullJd,value.fullJd)
})

test('incomplete JD is retained with full available text and warning',()=>{
  const original=job('4475956665',{fullJd:'A'.repeat(180)+'geograph[remainder of source sentence missing].'})
  const output=collectorJobsToApplyPilotJobs([original])
  assert.equal(output.length,1)
  assert.equal(output[0].needsJdReview,true)
  assert.match(output[0].description,/source sentence missing/)
})

test('only duplicated LinkedIn IDs collapse',()=>{
  const output=collectorJobsToApplyPilotJobs([job(),job('4475956665'),job()])
  assert.equal(output.length,2)
})

test('separate trustworthy timestamp is preserved without using export generatedAt',()=>{
  const output=collectorRecordToApplyPilotJob(job('4475956665',{publishedAt:'2026-10-13T09:30:00.000Z'}))
  assert.equal(output.publishedAt,'2026-10-13T09:30:00.000Z')
})
