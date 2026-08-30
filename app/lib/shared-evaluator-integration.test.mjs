import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJob } from './normalized-job.js'
import { dedupeJobs } from './cross-source-dedupe.js'

test('normalized Jobindex full JD becomes shared evaluator description',()=>{
  const job=normalizeJob({
    sourceJobId:'h1',postedDate:'2026-08-30',fullJd:'Lead delivery',
    foundBy:[{role:'Delivery Manager',tier:'primary'}],
    sourceRecords:[{source:'jobindex',sourceJobId:'h1'}],
  })
  assert.equal(job.publishedAt,'2026-08-30')
  assert.equal(job.description,'Lead delivery')
  assert.equal(job.foundBy.length,1)
})

test('dedupe unions discovery directions from both source records',()=>{
  const merged=dedupeJobs([
    {jobId:'linkedin:1',sourceJobId:'1',title:'Delivery Manager',company:'Acme',location:'Copenhagen',applicationUrl:'https://acme/jobs/1',foundBy:[{role:'Senior Delivery Manager',tier:'primary'}],sourceRecords:[{source:'linkedin',sourceJobId:'1'}]},
    {jobId:'jobindex:h1',sourceJobId:'h1',title:'Delivery Manager',company:'Acme',location:'Copenhagen',applicationUrl:'https://acme/jobs/1',foundBy:[{role:'IT Delivery Manager',tier:'adjacent'}],sourceRecords:[{source:'jobindex',sourceJobId:'h1'}]},
  ])
  assert.equal(merged.length,1)
  assert.deepEqual(merged[0].foundBy.map(item=>item.role).sort(),['IT Delivery Manager','Senior Delivery Manager'])
})
