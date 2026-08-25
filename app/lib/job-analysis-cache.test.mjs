import test from 'node:test'
import assert from 'node:assert/strict'
import {jobAnalysisCacheKey,readJobAnalysisCache,writeJobAnalysisCache} from './job-analysis-cache.js'

function memoryStorage(){
  const data=new Map()
  return {getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value))}
}

test('JD analysis cache is scoped by job id and CV source version',()=>{
  assert.notEqual(jobAnalysisCacheKey('job-1','cv-1'),jobAnalysisCacheKey('job-1','cv-2'))
  assert.notEqual(jobAnalysisCacheKey('job-1','cv-1'),jobAnalysisCacheKey('job-2','cv-1'))
})

test('JD analysis cache restores analysis and token',()=>{
  const storage=memoryStorage()
  writeJobAnalysisCache({storage,jobId:'job-1',sourceVersion:'cv-1',analysis:{roleMission:'Deliver'},token:'abc'})
  assert.deepEqual(readJobAnalysisCache({storage,jobId:'job-1',sourceVersion:'cv-1'}),{analysis:{roleMission:'Deliver'},token:'abc'})
})

test('JD analysis cache is not reused for a new CV version',()=>{
  const storage=memoryStorage()
  writeJobAnalysisCache({storage,jobId:'job-1',sourceVersion:'cv-1',analysis:{roleMission:'Deliver'}})
  assert.equal(readJobAnalysisCache({storage,jobId:'job-1',sourceVersion:'cv-2'}),null)
})
