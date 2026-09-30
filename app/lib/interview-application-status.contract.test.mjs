import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('Interview migration is additive and preserves existing Applied History rows',()=>{
  const sql=readFileSync(new URL('../../supabase/migrations/20260930_applied_jobs_application_status.sql',import.meta.url),'utf8')
  assert.match(sql,/add column if not exists application_status text not null default 'applied'/i)
  assert.match(sql,/check \(application_status in \('applied','interview'\)\)/i)
  assert.doesNotMatch(sql,/drop table|truncate|delete\s+from|update\s+public\.applied_jobs/i)
})

test('Interview UI is lifecycle-only and does not alter Night Flight matching code',()=>{
  const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  const archive=readFileSync(new URL('../components/applied-jobs-archive.js',import.meta.url),'utf8')
  assert.match(main,/isApplicationStatus\(status\)&&item/)
  assert.match(main,/applicationStatus:status/)
  assert.match(archive,/applicationStatusBadge/)
  assert.match(archive,/INTERVIEW/)
})
