import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('Applied History exposes direct editable lifecycle statuses for old vacancies',()=>{
  const archive=readFileSync(new URL('../components/applied-jobs-archive.js',import.meta.url),'utf8')
  assert.match(archive,/onStatusChange/)
  assert.match(archive,/<select/)
  assert.match(archive,/value="applied">APPLIED/)
  assert.match(archive,/value="interview">INTERVIEW/)
  assert.match(archive,/value="rejected">REJECTED/)
})

test('Applied History status change persists independently of the current search result list',()=>{
  const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  assert.match(main,/function changeAppliedArchiveStatus\(jobId,status\)/)
  assert.match(main,/appliedJobsRef\.current\.find\(job=>job\.jobId===jobId\)/)
  assert.match(main,/archiveAppliedJob\(\{[\s\S]*applicationStatus:status/)
  assert.match(main,/onStatusChange=\{changeAppliedArchiveStatus\}/)
})

test('Applied History editor is limited to durable application lifecycle states',()=>{
  const archive=readFileSync(new URL('../components/applied-jobs-archive.js',import.meta.url),'utf8')
  assert.doesNotMatch(archive,/value="considering"/)
  assert.doesNotMatch(archive,/value="ignore"/)
})
