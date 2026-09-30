import test from 'node:test'
import assert from 'node:assert/strict'
import {APPLIED_JOBS_STORAGE_KEY,archiveAppliedJob,readAppliedJobs,syncAppliedArchive} from './applied-jobs.js'

function memoryStorage(){
  const map=new Map()
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}
}

test('archives full vacancy snapshot when marked applied without browser side effects',()=>{
  const next=archiveAppliedJob({
    archive:[],
    job:{sourceJobId:'123',title:'Senior IT Project Manager',company:'Acme',location:'Copenhagen',source:'LinkedIn',originalUrl:'https://linkedin.com/jobs/view/123',publishedAt:'2026-09-01'},
    evaluation:{score:9.1},
    appliedAt:'2026-09-03T10:00:00.000Z'
  })
  assert.equal(next.length,1)
  assert.equal(next[0].jobId,'123')
  assert.equal(next[0].relevanceScore,9.1)
  assert.equal(next[0].applicationStatus,'applied')
})

test('re-applying updates snapshot without duplicate and preserves first applied date',()=>{
  let archive=archiveAppliedJob({archive:[],job:{sourceJobId:'123',title:'Old',company:'Acme'},appliedAt:'2026-09-01T10:00:00.000Z'})
  archive=archiveAppliedJob({archive,job:{sourceJobId:'123',title:'New',company:'Acme'},appliedAt:'2026-09-03T10:00:00.000Z'})
  assert.equal(archive.length,1)
  assert.equal(archive[0].title,'New')
  assert.equal(archive[0].appliedAt,'2026-09-01T10:00:00.000Z')
})

test('sync backfills application lifecycle statuses in memory only',()=>{
  const items=[
    {job:{sourceJobId:'a',title:'Role A',company:'A'}},
    {job:{sourceJobId:'b',title:'Role B',company:'B'}},
    {job:{sourceJobId:'c',title:'Role C',company:'C'}},
  ]
  const archive=syncAppliedArchive({archive:[],items,statuses:{a:'applied',b:'interview',c:'rejected'}})
  assert.deepEqual(archive.map(item=>[item.jobId,item.applicationStatus]),[['c','rejected'],['b','interview'],['a','applied']])
})

test('readAppliedJobs remains a legacy migration reader',()=>{
  const storage=memoryStorage()
  storage.setItem(APPLIED_JOBS_STORAGE_KEY,JSON.stringify([{jobId:'legacy',title:'Legacy',company:'Old'}]))
  assert.equal(readAppliedJobs(storage)[0].jobId,'legacy')
})


test('Applied to Interview keeps the same archive record and original applied date',()=>{
  let archive=archiveAppliedJob({
    archive:[],
    job:{sourceJobId:'123',title:'Senior PM',company:'Acme'},
    appliedAt:'2026-09-20T10:00:00.000Z',
    applicationStatus:'applied',
  })
  archive=archiveAppliedJob({
    archive,
    job:{sourceJobId:'123',title:'Senior PM',company:'Acme'},
    appliedAt:'2026-09-30T10:00:00.000Z',
    applicationStatus:'interview',
  })
  assert.equal(archive.length,1)
  assert.equal(archive[0].applicationStatus,'interview')
  assert.equal(archive[0].appliedAt,'2026-09-20T10:00:00.000Z')
})


test('Interview to Rejected keeps the same Applied History record and original applied date',()=>{
  let archive=archiveAppliedJob({
    archive:[],
    job:{sourceJobId:'456',title:'Delivery Manager',company:'Acme'},
    appliedAt:'2026-09-20T10:00:00.000Z',
    applicationStatus:'interview',
  })
  archive=archiveAppliedJob({
    archive,
    job:{sourceJobId:'456',title:'Delivery Manager',company:'Acme'},
    appliedAt:'2026-09-30T10:00:00.000Z',
    applicationStatus:'rejected',
  })
  assert.equal(archive.length,1)
  assert.equal(archive[0].applicationStatus,'rejected')
  assert.equal(archive[0].appliedAt,'2026-09-20T10:00:00.000Z')
})
