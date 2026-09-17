import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const layoutPath=new URL('../layout.js',import.meta.url)
const mainSearchPath=new URL('../main-search-base.js',import.meta.url)

test('Supabase bootstrap never writes Applied History back to localStorage',()=>{
  const layout=readFileSync(layoutPath,'utf8')
  assert.match(layout,/__APPLYPILOT_APPLIED_JOBS__/)
  assert.doesNotMatch(layout,/localStorage\.setItem\([^\n]*applypilot-applied-jobs|localStorage\.setItem\(key/)
})

test('main search loads Applied History through the durable client instead of localStorage',()=>{
  const source=readFileSync(mainSearchPath,'utf8')
  assert.match(source,/loadAppliedJobs/)
  assert.match(source,/persistAppliedJobs/)
  assert.doesNotMatch(source,/readAppliedJobs\(localStorage\)/)
  assert.doesNotMatch(source,/archiveAppliedJob\(\{storage:localStorage/)
  assert.doesNotMatch(source,/syncAppliedArchive\(\{storage:localStorage/)
})
