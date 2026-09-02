import test from 'node:test'
import assert from 'node:assert/strict'
import {masterPoolStorageKey,readLinkedInMasterPool,writeLinkedInMasterPool} from './linkedin-master-pool-cache.js'

function memoryStorage(){
  const data=new Map()
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key),
  }
}

test('master pool cache is isolated by Search Profile fingerprint',()=>{
  const storage=memoryStorage()
  writeLinkedInMasterPool({storage,fingerprint:'profile-a',candidates:[{jobId:'1'}]})
  writeLinkedInMasterPool({storage,fingerprint:'profile-b',candidates:[{jobId:'2'}]})
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'profile-a'}),[{jobId:'1'}])
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'profile-b'}),[{jobId:'2'}])
})

test('master pool cache safely returns empty for missing or invalid data',()=>{
  const storage=memoryStorage()
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'missing'}),[])
  storage.setItem(masterPoolStorageKey('broken'),'{bad json')
  assert.deepEqual(readLinkedInMasterPool({storage,fingerprint:'broken'}),[])
})
