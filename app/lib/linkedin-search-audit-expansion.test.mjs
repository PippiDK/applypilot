import test from 'node:test'
import assert from 'node:assert/strict'
import {createAuditRecord} from './linkedin-search-audit.js'

test('audit record preserves exact and expanded discovery provenance',()=>{
  const record=createAuditRecord({jobId:'4456985138',title:'Payroll Implementation Manager',company:'Deel',foundBy:[
    {role:'Integration Project Manager',query:'Implementation Manager',discoveryMode:'expanded'},
    {role:'Implementation Manager',query:'Implementation Manager',discoveryMode:'exact'}
  ]})
  assert.deepEqual(record.discoveryProvenance,[
    {mode:'EXPANDED',query:'Implementation Manager',sourceRole:'Integration Project Manager'},
    {mode:'EXACT',query:'Implementation Manager',sourceRole:'Implementation Manager'}
  ])
})
