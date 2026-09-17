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
})

test('re-applying updates snapshot without duplicate and preserves first applied date',()=>{
  let archive=archiveAppliedJob({archive:[],job:{sourceJobId:'123',title:'Old',company:'Acme'},appliedAt:'2026-09-01T10:00:00.000Z'})
  archive=archiveAppliedJob({archive,job:{sourceJobId:'123',title:'New',company:'Acme'},appliedAt:'2026-09-03T10:00:00.000Z'})
  assert.equal(archive.length,1)
  assert.equal(archive[0].title,'New')
  assert.equal(archive[0].appliedAt,'2026-09-01T10:00:00.000Z')
})

test('sync backfills existing APPLIED statuses in memory only',()=>{
  const items=[{job:{sourceJobId:'a',title:'Role A',company:'A'}},{job:{sourceJobId:'b',title:'Role B',company:'B'}}]
  const archive=syncAppliedArchive({archive:[],items,statuses:{a:'applied',b:'ignore'}})
  assert.deepEqual(archive.map(item=>item.jobId),['a'])
})

test('readAppliedJobs remains a legacy migration reader',()=>{
  const storage=memoryStorage()
  storage.setItem(APPLIED_JOBS_STORAGE_KEY,JSON.stringify([{jobId:'legacy',title:'Legacy',company:'Old'}]))
  assert.equal(readAppliedJobs(storage)[0].jobId,'legacy')
})
