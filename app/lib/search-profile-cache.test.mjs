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

test('keeps sibling CV role caches independent when one sourceVersion changes',()=>{
  const store=storage()
  const cv1={primaryRoles:['Project Manager'],adjacentRoles:['Delivery Lead']}
  const cv2={primaryRoles:['Financial IT Project Manager'],adjacentRoles:['Transformation Manager']}
  const cv3={primaryRoles:['Delivery Consultant'],adjacentRoles:['Integration Project Manager']}

  writeSearchProfileCache({storage:store,sourceVersion:'cv1-a',roles:cv1})
  writeSearchProfileCache({storage:store,sourceVersion:'cv2-a',roles:cv2})
  writeSearchProfileCache({storage:store,sourceVersion:'cv3-a',roles:cv3})

  assert.deepEqual(readSearchProfileCache({storage:store,sourceVersion:'cv1-a'}),cv1)
  assert.deepEqual(readSearchProfileCache({storage:store,sourceVersion:'cv3-a'}),cv3)
  assert.equal(readSearchProfileCache({storage:store,sourceVersion:'cv2-b'}),null)
  assert.deepEqual(readSearchProfileCache({storage:store,sourceVersion:'cv2-a'}),cv2)
})
