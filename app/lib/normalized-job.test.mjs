import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJob, sourceLabel, bestFullJd } from './normalized-job.js'

test('normalizes one LinkedIn source record', () => {
  const job = normalizeJob({
    sourceJobId: '123',
    title: 'Delivery Manager',
    company: 'Acme',
    location: 'Copenhagen',
    fullJd: 'LinkedIn JD',
    sourceRecords: [{ source: 'linkedin', sourceJobId: '123', detailUrl: 'https://linkedin.example/123' }],
  })
  assert.equal(job.jobId, 'linkedin:123')
  assert.equal(sourceLabel(job), 'LinkedIn')
})

test('combined provenance renders both source names in stable order', () => {
  const job = normalizeJob({
    jobId: 'merged:test', title: 'Delivery Manager', company: 'Acme',
    sourceRecords: [{ source: 'jobindex' }, { source: 'linkedin' }],
  })
  assert.equal(sourceLabel(job), 'LinkedIn · Jobindex')
})

test('bestFullJd selects a usable JD from either source', () => {
  assert.equal(bestFullJd([{ source: 'linkedin', fullJd: '' }, { source: 'jobindex', fullJd: 'Complete JD' }], ''), 'Complete JD')
})

test('normalization preserves evaluator-facing fields', () => {
  const job = normalizeJob({sourceJobId:'42',sourceRecords:[{source:'jobindex'}],score:88,reason:'keep'})
  assert.equal(job.score,88)
  assert.equal(job.reason,'keep')
})
