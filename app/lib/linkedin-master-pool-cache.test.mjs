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
  writeLinkedInMasterPool({storage,fingerprint:'profile-a',candidates:[{jobId:'1'}]})
  writeLinkedInMasterPool({storage,fingerprint:'profile-b',candidates:[{jobId:'2'}]})
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'profile-a'}),[])
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'profile-b'}),[{jobId:'2'}])
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
  writeLinkedInMasterPool({storage,fingerprint:'profile-cache',candidates:[{jobId:'1'}],verifiedJobs:[{sourceJobId:'1',title:'Cached PM'}]})
  const snapshot=readLinkedInMasterPoolSnapshot({storage,fingerprint:'profile-cache'})
  assert.deepEqual(snapshot.candidates,[{jobId:'1'}])
  assert.deepEqual(snapshot.verifiedJobs,[{sourceJobId:'1',title:'Cached PM'}])
  assert.equal(typeof snapshot.savedAt,'string')
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
