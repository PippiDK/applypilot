import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('Morning Review distinguishes unfinished queue states from real failures',async()=>{
  const ui=await readFile(new URL('../components/night-flight-morning-review.js',import.meta.url),'utf8')
  const css=await readFile(new URL('../components/night-flight-morning-review.module.css',import.meta.url),'utf8')
  for(const status of ['QUEUED','PROCESSING','RETRY']){
    assert.match(ui,new RegExp("status==='"+status+"'[^\\n]*tone:'pending'"))
  }
  assert.match(ui,/status==='FAILED'[^\n]*tone:'failed'/)
  assert.match(ui,/IN_PROGRESS_JOB_STATUSES\.has\(selected\?\.status\)/)
  assert.match(ui,/const refreshed=await fetchNightFlightReview\(\)/)
  assert.match(ui,/setReview\(refreshed\)/)
  assert.match(css,/\.pending\{/)
  assert.doesNotMatch(ui,/item\.status==='READY'\?'READY':'FAILED'/)
})
