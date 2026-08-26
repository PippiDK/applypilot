import test from 'node:test'
import assert from 'node:assert/strict'
import {bestCvCacheKey,readBestCvCache,writeBestCvCache} from './best-cv-cache.js'

function storage(){
  const map=new Map()
  return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value))}
}
const cvs=[{id:'cv-1',sourceVersion:'v1'},{id:'cv-2',sourceVersion:'v2'}]

test('Best CV cache changes when JD, candidate membership or any CV sourceVersion changes',()=>{
  const base=bestCvCacheKey({jobId:'job-1',description:'Full JD alpha',cvs})
  assert.ok(base)
  assert.notEqual(base,bestCvCacheKey({jobId:'job-1',description:'Full JD beta',cvs}))
  assert.notEqual(base,bestCvCacheKey({jobId:'job-1',description:'Full JD alpha',cvs:[{id:'cv-1',sourceVersion:'v1'},{id:'cv-2',sourceVersion:'v3'}]}))
  assert.notEqual(base,bestCvCacheKey({jobId:'job-1',description:'Full JD alpha',cvs:[...cvs,{id:'cv-3',sourceVersion:'v3'}]}))
})

test('unchanged vacancy and CV library reuse the saved Best CV analysis',()=>{
  const store=storage()
  const args={storage:store,jobId:'job-1',description:'Full JD alpha',cvs}
  const analysis={recommendedCvId:'cv-2',rankedCvIds:['cv-2','cv-1'],reason:'Best positioned.',recommendation:'use_as_is',updateFocus:[],selectorVersion:'best-cv-selector-v1'}
  assert.equal(writeBestCvCache({...args,analysis}),true)
  assert.deepEqual(readBestCvCache(args),analysis)
  assert.equal(readBestCvCache({...args,description:'Changed JD'}),null)
})
