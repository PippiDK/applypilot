import test from 'node:test'
import assert from 'node:assert/strict'
import {APPLIED_JOBS_STORAGE_KEY} from './applied-jobs.js'
import {loadAppliedJobs,persistAppliedJobs} from './applied-jobs-client.js'

function memoryStorage(initial={}){
  const map=new Map(Object.entries(initial))
  return {
    getItem:key=>map.get(key)??null,
    setItem:(key,value)=>map.set(key,value),
    removeItem:key=>map.delete(key),
    has:key=>map.has(key),
  }
}

const remote=[{
  jobId:'same',
  title:'Remote title',
  company:'Remote company',
  location:'Copenhagen',
  source:'LinkedIn',
  originalUrl:'https://example.com/remote',
  publishedAt:'2026-09-10',
  appliedAt:'2026-09-17T10:00:00.000Z',
  relevanceScore:88,
}]

const legacy=[
  {...remote,title:'Stale local title',company:'Stale local company'},
  {
    jobId:'local-only',
    title:'Legacy only',
    company:'Legacy Co',
    location:'Copenhagen',
    source:'LinkedIn',
    originalUrl:'https://example.com/legacy',
    publishedAt:'2026-09-11',
    appliedAt:'2026-09-17T11:00:00.000Z',
    relevanceScore:81,
  },
]

test('one-time legacy migration keeps Supabase data authoritative on duplicate job IDs',async()=>{
  const storage=memoryStorage({[APPLIED_JOBS_STORAGE_KEY]:JSON.stringify(legacy)})
  let posted=null
  const fetchImpl=async(url,options={})=>{
    assert.equal(url,'/api/applied-jobs')
    assert.equal(options.method,'POST')
    posted=JSON.parse(options.body).jobs
    return {ok:true,json:async()=>({jobs:posted})}
  }

  const jobs=await loadAppliedJobs({storage,fetchImpl,bootstrapJobs:remote})

  assert.equal(posted.length,2)
  assert.equal(posted.find(job=>job.jobId==='same').title,'Remote title')
  assert.equal(jobs.find(job=>job.jobId==='same').company,'Remote company')
  assert.equal(jobs.some(job=>job.jobId==='local-only'),true)
  assert.equal(storage.has(APPLIED_JOBS_STORAGE_KEY),false)
})

test('legacy browser history is retained when migration save fails',async()=>{
  const storage=memoryStorage({[APPLIED_JOBS_STORAGE_KEY]:JSON.stringify(legacy)})
  const fetchImpl=async()=>({ok:false,status:500,json:async()=>({error:'failed'})})

  const jobs=await loadAppliedJobs({storage,fetchImpl,bootstrapJobs:remote})

  assert.equal(jobs.find(job=>job.jobId==='same').title,'Remote title')
  assert.equal(jobs.some(job=>job.jobId==='local-only'),true)
  assert.equal(storage.has(APPLIED_JOBS_STORAGE_KEY),true)
})

test('normal Applied History saves use the API response as canonical state',async()=>{
  const next=[{...remote[0],title:'Updated server title'}]
  const fetchImpl=async(url,options={})=>{
    assert.equal(url,'/api/applied-jobs')
    assert.equal(options.method,'POST')
    return {ok:true,json:async()=>({jobs:next})}
  }

  assert.deepEqual(await persistAppliedJobs(remote,{fetchImpl}),next)
})
