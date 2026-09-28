import test from 'node:test'
import assert from 'node:assert/strict'
import {SEARCH_PROFILE_STORAGE_KEY,clearDisposableSearchCaches,isStorageQuotaError,writeSearchProfileStorage} from './storage-housekeeping.js'
import {masterPoolStorageKey} from './linkedin-master-pool-cache.js'

function memoryStorage({quotaLimit=Infinity}={}){
  const data=new Map()
  return {
    get length(){return data.size},
    key:index=>Array.from(data.keys())[index]??null,
    getItem:key=>data.has(key)?data.get(key):null,
    setItem(key,value){
      const next=new Map(data)
      next.set(key,String(value))
      const size=Array.from(next.entries()).reduce((sum,[k,v])=>sum+k.length+v.length,0)
      if(size>quotaLimit) throw new DOMException('Setting the value exceeded the quota.','QuotaExceededError')
      data.set(key,String(value))
    },
    removeItem:key=>data.delete(key),
  }
}

test('disposable cache cleanup preserves critical user state',()=>{
  const storage=memoryStorage()
  storage.setItem('applypilot-cv-library','CVS')
  storage.setItem('applypilot-job-statuses-v1','STATUSES')
  storage.setItem(SEARCH_PROFILE_STORAGE_KEY,'PROFILE')
  storage.setItem(masterPoolStorageKey('old'),'POOL')
  storage.setItem('applypilot-search-profile:v1:cv','ROLES')
  storage.setItem('applypilot-search-profile-exclusions:v1:rules','EXCLUSIONS')
  storage.setItem('applypilot-expertise-match:v3:job:cv','MATCH')

  const removed=clearDisposableSearchCaches({storage})

  assert.equal(removed,4)
  assert.equal(storage.getItem('applypilot-cv-library'),'CVS')
  assert.equal(storage.getItem('applypilot-job-statuses-v1'),'STATUSES')
  assert.equal(storage.getItem(SEARCH_PROFILE_STORAGE_KEY),'PROFILE')
  assert.equal(storage.getItem(masterPoolStorageKey('old')),null)
  assert.equal(storage.getItem('applypilot-search-profile:v1:cv'),null)
  assert.equal(storage.getItem('applypilot-search-profile-exclusions:v1:rules'),null)
  assert.equal(storage.getItem('applypilot-expertise-match:v3:job:cv'),null)
})

test('Search Profile write prunes obsolete master pools before saving',()=>{
  const storage=memoryStorage()
  storage.setItem(masterPoolStorageKey('old-a'),'A'.repeat(50))
  storage.setItem(masterPoolStorageKey('current'),'B'.repeat(50))

  const result=writeSearchProfileStorage({
    storage,
    profile:{roles:'Senior IT Project Manager'},
    keepMasterPoolFingerprint:'current',
  })

  assert.equal(result.recovered,false)
  assert.equal(storage.getItem(masterPoolStorageKey('old-a')),null)
  assert.equal(storage.getItem(masterPoolStorageKey('current')),'B'.repeat(50))
  assert.match(storage.getItem(SEARCH_PROFILE_STORAGE_KEY),/Senior IT Project Manager/)
})

test('quota recovery clears only disposable caches and retries Search Profile once',()=>{
  const storage=memoryStorage({quotaLimit:400})
  storage.setItem('applypilot-cv-library','C'.repeat(70))
  storage.setItem('applypilot-job-statuses-v1','S'.repeat(20))
  storage.setItem(masterPoolStorageKey('current'),'P'.repeat(80))
  storage.setItem('applypilot-search-profile:v1:cv','R'.repeat(30))

  const result=writeSearchProfileStorage({
    storage,
    profile:{roles:'Senior IT Project Manager',savedAt:'2026-09-28T16:00:00.000Z'},
    keepMasterPoolFingerprint:'current',
  })

  assert.equal(result.recovered,true)
  assert.equal(storage.getItem('applypilot-cv-library'),'C'.repeat(70))
  assert.equal(storage.getItem('applypilot-job-statuses-v1'),'S'.repeat(20))
  assert.equal(storage.getItem(masterPoolStorageKey('current')),null)
  assert.equal(storage.getItem('applypilot-search-profile:v1:cv'),null)
  assert.match(storage.getItem(SEARCH_PROFILE_STORAGE_KEY),/Senior IT Project Manager/)
})

test('quota detection is narrow to storage quota failures',()=>{
  assert.equal(isStorageQuotaError(new DOMException('quota exceeded','QuotaExceededError')),true)
  assert.equal(isStorageQuotaError(new Error('network failed')),false)
})
