import test from 'node:test'
import assert from 'node:assert/strict'
import {createAuditRecord,updateAuditRecord,auditList} from './linkedin-search-audit.js'

test('creates a privacy-safe discovery audit record',()=>{
  const record=createAuditRecord({jobId:'123',title:'Senior Project Manager',company:'Example',description:'SECRET JD'})
  assert.deepEqual(record,{
    jobId:'123',title:'Senior Project Manager',company:'Example',stage:'DISCOVERED',decision:'PENDING',reason:null,score:null,discoveryProvenance:[],
  })
  assert.equal('description' in record,false)
})

test('updates one audit record without leaking arbitrary source fields',()=>{
  const map=new Map([['123',createAuditRecord({jobId:'123',title:'PM',company:'Co'})]])
  updateAuditRecord(map,'123',{stage:'BELOW_60',decision:'REJECT',reason:'Poor fit',score:5.8,description:'SECRET',cvText:'SECRET CV'})
  assert.deepEqual(auditList(map),[{
    jobId:'123',title:'PM',company:'Co',stage:'BELOW_60',decision:'REJECT',reason:'Poor fit',score:5.8,discoveryProvenance:[],
  }])
})
