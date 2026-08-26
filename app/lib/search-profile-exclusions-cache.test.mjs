import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveSearchProfileExclusions,searchProfileExclusionsFingerprint} from './search-profile-cache.js'
import {SEARCH_PROFILE_EXCLUSIONS_VERSION} from './search-profile-ai.js'

function memoryStorage(){
  const data=new Map()
  return {getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value))}
}

const rules=[{category:'travel',operator:'max',value:'20',unit:'percent',evaluation:'deterministic',originalText:'travel max 20%'}]

test('unchanged saved exclusions use zero AI calls',async()=>{
  const storage=memoryStorage()
  const exclusions='Travel max 20%'
  let calls=0
  const result=await resolveSearchProfileExclusions({
    storage,
    exclusionsText:exclusions,
    savedProfile:{
      exclusions,
      exclusionRules:rules,
      exclusionsFingerprint:searchProfileExclusionsFingerprint(exclusions),
      exclusionsParserVersion:SEARCH_PROFILE_EXCLUSIONS_VERSION
    },
    parse:async()=>{calls++;return {rules}}
  })
  assert.equal(calls,0)
  assert.equal(result.source,'profile')
  assert.deepEqual(result.rules,rules)
})

test('changed exclusions call AI once and repeated text uses cache',async()=>{
  const storage=memoryStorage()
  let calls=0
  const parse=async()=>{calls++;return {rules}}
  const first=await resolveSearchProfileExclusions({storage,exclusionsText:'Travel max 20%',savedProfile:{},parse})
  const second=await resolveSearchProfileExclusions({storage,exclusionsText:'  Travel   max 20%  ',savedProfile:{},parse})
  assert.equal(first.source,'ai')
  assert.equal(second.source,'cache')
  assert.equal(calls,1)
  assert.deepEqual(second.rules,rules)
})

test('blank exclusions use zero AI calls',async()=>{
  const storage=memoryStorage()
  let calls=0
  const result=await resolveSearchProfileExclusions({storage,exclusionsText:'',savedProfile:{},parse:async()=>{calls++;return {rules}}})
  assert.equal(calls,0)
  assert.equal(result.source,'empty')
  assert.deepEqual(result.rules,[])
})
