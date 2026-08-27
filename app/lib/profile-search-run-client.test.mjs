import test from 'node:test'
import assert from 'node:assert/strict'
import {runProfileSearchRun,readActiveSearchRun} from './profile-search-run-client.js'

function response(data,ok=true){return {ok,json:async()=>data}}
function memoryStorage(){const map=new Map();return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)}}

const plan={directions:[{key:'it project manager',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}]}

test('one user action orchestrates multiple discovery and JD calls until complete',async()=>{
  const calls=[]
  let discovery=0
  let processing=0
  const fetchImpl=async (url,options={})=>{
    calls.push(url)
    if(url.endsWith('/run')) return response({mode:'preview',run:{id:'preview-1',status:'DISCOVERING',freshness_days:7,union_search_plan:plan,exclusion_rules:[],discovery_state:{},stats:{}},candidates:[]})
    if(url.endsWith('/discover')){
      discovery++
      const complete=discovery===2
      return response({mode:'preview',run:{id:'preview-1',status:complete?'READING_JDS':'DISCOVERING',freshness_days:7,union_search_plan:plan,exclusion_rules:[],stats:{discovered:3}},candidates:[{jobId:'1'},{jobId:'2'},{jobId:'3'}],complete,progress:{discovered:3}})
    }
    if(url.endsWith('/process')){
      processing++
      const complete=processing===2
      const candidates=[{jobId:'1',detailStatus:'PROCESSED',job:{sourceJobId:'1'},evaluation:{score:9},audit:{decision:'KEEP'}},{jobId:'2',detailStatus:'PROCESSED',job:{sourceJobId:'2'},evaluation:{score:8},audit:{decision:'KEEP'}},{jobId:'3',detailStatus:complete?'PROCESSED':'PENDING',job:complete?{sourceJobId:'3'}:null,evaluation:complete?{score:7}:null,audit:complete?{decision:'KEEP'}:null}]
      return response({mode:'preview',run:{id:'preview-1',status:complete?'COMPLETE':'READING_JDS',coverage:{status:'SEARCHED'},stats:{discovered:3,fullJdProcessed:complete?3:2}},candidates,complete,progress:{discovered:3,fullJdProcessed:complete?3:2}})
    }
    throw new Error(`unexpected ${url}`)
  }
  const result=await runProfileSearchRun({freshnessDays:7,unionSearchPlan:plan,exclusionRules:[],fetchImpl,storage:memoryStorage()})
  assert.equal(discovery,2)
  assert.equal(processing,2)
  assert.equal(result.jobs.length,3)
  assert.equal(calls.length,5)
})

test('preview checkpoints are saved so a refresh can resume the active run',async()=>{
  const storage=memoryStorage()
  let calls=0
  const fetchImpl=async url=>{
    calls++
    if(url.endsWith('/run')) return response({mode:'preview',run:{id:'preview-2',status:'DISCOVERING',freshness_days:7,union_search_plan:plan,exclusion_rules:[],discovery_state:{},stats:{}},candidates:[]})
    throw new Error('network interrupted')
  }
  await assert.rejects(()=>runProfileSearchRun({freshnessDays:7,unionSearchPlan:plan,exclusionRules:[],fetchImpl,storage}))
  const saved=readActiveSearchRun(storage)
  assert.equal(saved.run.id,'preview-2')
  assert.equal(calls,2)
})
