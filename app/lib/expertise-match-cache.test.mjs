import test from 'node:test'
import assert from 'node:assert/strict'
import {expertiseMatchCacheKey,readExpertiseMatchCache,writeExpertiseMatchCache} from './expertise-match-cache.js'

function memoryStorage(){
  const data=new Map()
  return {
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
  }
}

test('cache key is scoped by LinkedIn job id and CV source version',()=>{
  assert.notEqual(expertiseMatchCacheKey('4407027317','cv-v1'),expertiseMatchCacheKey('4407027317','cv-v2'))
  assert.notEqual(expertiseMatchCacheKey('4407027317','cv-v1'),expertiseMatchCacheKey('9999999999','cv-v1'))
})

test('saved Expertise Match is reused for the same job id and CV source version',()=>{
  const storage=memoryStorage()
  const analysis={expertiseMatch:76,whyYouFit:['delivery']}
  writeExpertiseMatchCache({storage,jobId:'4407027317',sourceVersion:'cv-v1',analysis})
  assert.deepEqual(readExpertiseMatchCache({storage,jobId:'4407027317',sourceVersion:'cv-v1'}),analysis)
})

test('cached result is not reused after CV source version changes',()=>{
  const storage=memoryStorage()
  writeExpertiseMatchCache({storage,jobId:'4407027317',sourceVersion:'cv-v1',analysis:{expertiseMatch:76}})
  assert.equal(readExpertiseMatchCache({storage,jobId:'4407027317',sourceVersion:'cv-v2'}),null)
})
