import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const runRoute=fs.readFileSync(new URL('../api/linkedin-profile-search/run/route.js',import.meta.url),'utf8')
const processRoute=fs.readFileSync(new URL('../api/linkedin-profile-search/process/route.js',import.meta.url),'utf8')
const store=fs.readFileSync(new URL('./search-run-store.js',import.meta.url),'utf8')

test('new Search Runs are stamped profile-semantic-v1',()=>{
  assert.match(runRoute,/profile-semantic-v1/)
  assert.match(store,/profile-semantic-v1/)
})

test('process route keeps READING_JDS Search Run architecture',()=>{
  assert.match(processRoute,/READING_JDS/)
  assert.match(processRoute,/runProfileJdBatch/)
  assert.match(processRoute,/loadPendingPersistentCandidates/)
  assert.match(processRoute,/saveProcessedPersistentCandidates/)
})
