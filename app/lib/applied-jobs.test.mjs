import test from 'node:test'
import assert from 'node:assert/strict'
import {APPLIED_JOBS_STORAGE_KEY,archiveAppliedJob,readAppliedJobs,syncAppliedArchive} from './applied-jobs.js'

function memoryStorage(){
  const map=new Map()
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}
}

test('archives full vacancy snapshot when marked applied',()=>{
  const storage=memoryStorage()
  const next=archiveAppliedJob({
    storage,
    archive:[],
    job:{sourceJobId:'123',title:'Senior IT Project Manager',company:'Acme',location:'Copenhagen',source:'LinkedIn',originalUrl:'https://linkedin.com/jobs/view/123',publishedAt:'2026-09-01'},
    evaluation:{score:9.1},
    appliedAt:'2026-09-03T10:00:00.000Z'
  })
  assert.equal(next.length,1)
  assert.equal(next[0].jobId,'123')
  assert.equal(next[0].relevanceScore,9.1)
  assert.deepEqual(readAppliedJobs(storage),next)
})

test('re-applying updates snapshot without duplicate and preserves first applied date',()=>{
  const storage=memoryStorage()
  let archive=archiveAppliedJob({storage,archive:[],job:{sourceJobId:'123',title:'Old',company:'Acme'},appliedAt:'2026-09-01T10:00:00.000Z'})
  archive=archiveAppliedJob({storage,archive,job:{sourceJobId:'123',title:'New',company:'Acme'},appliedAt:'2026-09-03T10:00:00.000Z'})
  assert.equal(archive.length,1)
  assert.equal(archive[0].title,'New')
  assert.equal(archive[0].appliedAt,'2026-09-01T10:00:00.000Z')
})

test('sync backfills existing APPLIED statuses from current search items',()=>{
  const storage=memoryStorage()
  const items=[{job:{sourceJobId:'a',title:'Role A',company:'A'}},{job:{sourceJobId:'b',title:'Role B',company:'B'}}]
  const archive=syncAppliedArchive({storage,archive:[],items,statuses:{a:'applied',b:'ignore'}})
  assert.deepEqual(archive.map(item=>item.jobId),['a'])
  assert.ok(storage.getItem(APPLIED_JOBS_STORAGE_KEY))
})
