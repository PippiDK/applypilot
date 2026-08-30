import test from 'node:test'
import assert from 'node:assert/strict'
import { dedupeJobs } from './cross-source-dedupe.js'

test('merges obvious same vacancy across sources by application URL', () => {
  const jobs = dedupeJobs([
    { jobId:'linkedin:1', sourceJobId:'1', title:'Senior Project Manager', company:'Acme A/S', location:'Copenhagen', applicationUrl:'https://acme.example/jobs/42/', fullJd:'', sourceRecords:[{source:'linkedin',sourceJobId:'1',applicationUrl:'https://acme.example/jobs/42/'}] },
    { jobId:'jobindex:h1', sourceJobId:'h1', title:'Senior Project Manager', company:'Acme A/S', location:'Copenhagen', applicationUrl:'https://acme.example/jobs/42', fullJd:'Full JD', sourceRecords:[{source:'jobindex',sourceJobId:'h1',applicationUrl:'https://acme.example/jobs/42',fullJd:'Full JD'}] },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceRecords.length, 2)
  assert.equal(jobs[0].fullJd, 'Full JD')
})

test('merges exact company title location across different sources when dates do not conflict', () => {
  const jobs=dedupeJobs([
    {jobId:'linkedin:2',title:'Delivery Manager',company:'Acme A/S',location:'Copenhagen',postedDate:'2026-08-30',sourceRecords:[{source:'linkedin'}]},
    {jobId:'jobindex:h2',title:'Delivery Manager',company:'Acme AS',location:'Copenhagen',postedDate:'2026-08-29',sourceRecords:[{source:'jobindex'}]},
  ])
  assert.equal(jobs.length,1)
})

test('does not merge merely similar vacancies when identity is uncertain', () => {
  const jobs = dedupeJobs([
    { jobId:'linkedin:1', title:'Project Manager', company:'Acme', location:'Copenhagen', applicationUrl:'', sourceRecords:[{source:'linkedin'}] },
    { jobId:'jobindex:h2', title:'Senior Project Manager', company:'Acme', location:'Copenhagen', applicationUrl:'', sourceRecords:[{source:'jobindex'}] },
  ])
  assert.equal(jobs.length, 2)
})

test('does not merge same-source jobs solely by title company location', () => {
  const jobs=dedupeJobs([
    {jobId:'linkedin:1',title:'Project Manager',company:'Acme',location:'Copenhagen',sourceRecords:[{source:'linkedin'}]},
    {jobId:'linkedin:2',title:'Project Manager',company:'Acme',location:'Copenhagen',sourceRecords:[{source:'linkedin'}]},
  ])
  assert.equal(jobs.length,2)
})
