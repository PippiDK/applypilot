import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('Rejected migration expands the existing lifecycle without rewriting application rows',()=>{
  const sql=readFileSync(new URL('../../supabase/migrations/20260930_applied_jobs_rejected_status.sql',import.meta.url),'utf8')
  assert.match(sql,/drop constraint if exists applied_jobs_application_status_check/i)
  assert.match(sql,/check \(application_status in \('applied','interview','rejected'\)\)/i)
  assert.doesNotMatch(sql,/drop table|truncate|delete\s+from|update\s+public\.applied_jobs/i)
})

test('Rejected remains in Applied History through the shared application lifecycle path',()=>{
  const statuses=readFileSync(new URL('./job-statuses.js',import.meta.url),'utf8')
  const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
  const archive=readFileSync(new URL('../components/applied-jobs-archive.js',import.meta.url),'utf8')
  assert.match(statuses,/APPLICATION_STATUSES=new Set\(\['applied','interview','rejected'\]\)/)
  assert.match(main,/isApplicationStatus\(status\)&&item/)
  assert.match(archive,/REJECTED/)
})

test('Rejected uses red text on a grey background in selector and Applied History badge',()=>{
  const globals=readFileSync(new URL('../globals.css',import.meta.url),'utf8')
  const polish=readFileSync(new URL('../ux-polish.css',import.meta.url),'utf8')
  assert.match(globals,/\.jobStatusSelect\.status-rejected\{[^}]*border-color:#6b7280;[^}]*color:#fca5a5;[^}]*background:#25282d/i)
  assert.match(polish,/\.applicationStatus-rejected\{[^}]*border:1px solid #6b7280;[^}]*color:#fca5a5;[^}]*background:#25282d/i)
})
