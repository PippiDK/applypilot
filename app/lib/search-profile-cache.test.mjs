import test from 'node:test'
import assert from 'node:assert/strict'
import {searchProfileCacheKey,readSearchProfileCache,writeSearchProfileCache} from './search-profile-cache.js'

function storage(){
  const map=new Map()
  return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value)}
}

test('cache key changes when CV sourceVersion changes',()=>{
  assert.notEqual(searchProfileCacheKey('cv-v1'),searchProfileCacheKey('cv-v2'))
})

test('writes and reads generated roles for unchanged CV 1',()=>{
  const store=storage()
  const roles={primaryRoles:['Senior Project Manager'],adjacentRoles:['Delivery Manager']}
  assert.equal(writeSearchProfileCache({storage:store,sourceVersion:'cv-v1',roles}),true)
  assert.deepEqual(readSearchProfileCache({storage:store,sourceVersion:'cv-v1'}),roles)
  assert.equal(readSearchProfileCache({storage:store,sourceVersion:'cv-v2'}),null)
})
