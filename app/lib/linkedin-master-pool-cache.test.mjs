import test from 'node:test'
import assert from 'node:assert/strict'
import {clearObsoleteLinkedInMasterPools,masterPoolStorageKey,readLinkedInMasterPool,readLinkedInMasterPoolSnapshot,isLinkedInMasterPoolFresh,writeLinkedInMasterPool} from './linkedin-master-pool-cache.js'

function memoryStorage(){
  const data=new Map()
  return {
    get length(){return data.size},
    key:index=>Array.from(data.keys())[index]??null,
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key),
  }
}

test('master pool cache keeps only the current Search Profile fingerprint',()=>{
  const storage=memoryStorage()
  const now=new Date('2026-10-12T12:00:00Z')
  writeLinkedInMasterPool({storage,fingerprint:'profile-a',candidates:[{jobId:'1',publishedAt:'2026-10-12T08:00:00Z'}],now})
  writeLinkedInMasterPool({storage,fingerprint:'profile-b',candidates:[{jobId:'2',publishedAt:'2026-10-12T09:00:00Z'}],now})
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'profile-a',now}),[])
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'profile-b',now}),[{jobId:'2',publishedAt:'2026-10-12T09:00:00Z'}])
})

test('obsolete master pools are pruned without removing the current pool',()=>{
  const storage=memoryStorage()
  storage.setItem(masterPoolStorageKey('old-a'),'{}')
  storage.setItem(masterPoolStorageKey('old-b'),'{}')
  storage.setItem(masterPoolStorageKey('current'),'{}')
  assert.equal(clearObsoleteLinkedInMasterPools({storage,keepFingerprint:'current'}),2)
  assert.equal(storage.getItem(masterPoolStorageKey('old-a')),null)
  assert.equal(storage.getItem(masterPoolStorageKey('old-b')),null)
  assert.equal(storage.getItem(masterPoolStorageKey('current')),'{}')
})

test('master pool cache safely returns empty for missing or invalid data',()=>{
  const storage=memoryStorage()
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'missing'}),[])
  storage.setItem(masterPoolStorageKey('broken'),'{bad json')
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'broken'}),[])
})

test('master pool snapshot persists verified jobs together with discovery candidates',()=>{
  const storage=memoryStorage()
  const now=new Date('2026-10-12T12:00:00Z')
  const candidate={jobId:'1',publishedAt:'2026-10-12T08:00:00Z'}
  const verified={sourceJobId:'1',title:'Cached PM',publishedAt:'2026-10-12T08:00:00Z'}
  writeLinkedInMasterPool({storage,fingerprint:'profile-cache',candidates:[candidate],verifiedJobs:[verified],now})
  const snapshot=readLinkedInMasterPoolSnapshot({storage,fingerprint:'profile-cache',now})
  assert.deepEqual(snapshot.candidates,[candidate])
  assert.deepEqual(snapshot.verifiedJobs,[verified])
  assert.equal(typeof snapshot.savedAt,'string')
})

test('master pool retention is rolling 10 days for candidates and verified jobs',()=>{
  const storage=memoryStorage()
  const now=new Date('2026-10-12T12:00:00Z')
  const inside='2026-10-02T12:00:01Z'
  const boundary='2026-10-02T12:00:00Z'
  const expired='2026-10-02T11:59:59Z'
  writeLinkedInMasterPool({
    storage,
    fingerprint:'rolling-10d',
    now,
    candidates:[
      {jobId:'inside',publishedAt:inside},
      {jobId:'boundary',publishedAt:boundary},
      {jobId:'expired',publishedAt:expired},
    ],
    verifiedJobs:[
      {sourceJobId:'inside',publishedAt:inside},
      {sourceJobId:'boundary',publishedAt:boundary},
      {sourceJobId:'expired',publishedAt:expired},
    ],
  })
  const snapshot=readLinkedInMasterPoolSnapshot({storage,fingerprint:'rolling-10d',now})
  assert.deepEqual(snapshot.candidates.map(item=>item.jobId),['inside','boundary'])
  assert.deepEqual(snapshot.verifiedJobs.map(item=>item.sourceJobId),['inside','boundary'])
})

test('reading an older cache snapshot prunes entries beyond the rolling 10-day horizon before Search can reuse them',()=>{
  const storage=memoryStorage()
  const key=masterPoolStorageKey('legacy-cache')
  storage.setItem(key,JSON.stringify({
    version:2,
    savedAt:'2026-10-11T12:00:00Z',
    candidates:[
      {jobId:'fresh',publishedAt:'2026-10-11T10:00:00Z'},
      {jobId:'old',publishedAt:'2026-10-01T10:00:00Z'},
    ],
    verifiedJobs:[
      {sourceJobId:'fresh',publishedAt:'2026-10-11T10:00:00Z'},
      {sourceJobId:'old',publishedAt:'2026-10-01T10:00:00Z'},
    ],
  }))
  const snapshot=readLinkedInMasterPoolSnapshot({storage,fingerprint:'legacy-cache',now:new Date('2026-10-12T12:00:00Z')})
  assert.deepEqual(snapshot.candidates.map(item=>item.jobId),['fresh'])
  assert.deepEqual(snapshot.verifiedJobs.map(item=>item.sourceJobId),['fresh'])
})

test('fresh-cache helper only allows short local view reuse',()=>{
  const now=new Date('2026-09-02T12:00:00Z')
  assert.equal(isLinkedInMasterPoolFresh({savedAt:'2026-09-02T11:55:00Z'},now),true)
  assert.equal(isLinkedInMasterPoolFresh({savedAt:'2026-09-02T11:30:00Z'},now),false)
})

test('quota exhaustion does not fail master-pool writes',()=>{
  const quotaStorage={
    get length(){return 0},
    key:()=>null,
    getItem:()=>null,
    setItem:()=>{throw new DOMException('quota exceeded','QuotaExceededError')},
    removeItem:()=>{},
  }
  assert.doesNotThrow(()=>writeLinkedInMasterPool({storage:quotaStorage,fingerprint:'quota-profile',candidates:[{jobId:'1'}]}))
})
