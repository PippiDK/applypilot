import test from 'node:test'
import assert from 'node:assert/strict'
import {requestSearchProfileRoles,requestSearchProfileExclusions} from './search-profile-client.js'

const CV='x'.repeat(200)

test('requests Search Profile roles from CV 1 only',async()=>{
  let seen=null
  const fetchImpl=async (url,options)=>{
    seen={url,options,body:JSON.parse(options.body)}
    return {ok:true,json:async()=>({roles:{primaryRoles:['Senior Project Manager'],adjacentRoles:['Delivery Manager']}})}
  }
  const roles=await requestSearchProfileRoles({cvText:CV,fetchImpl})
  assert.equal(seen.url,'/api/search-profile')
  assert.deepEqual(seen.body,{cvText:CV})
  assert.deepEqual(roles.primaryRoles,['Senior Project Manager'])
})

test('requests structured exclusions only when caller explicitly invokes save processing',async()=>{
  let seen=null
  const fetchImpl=async (url,options)=>{
    seen={url,body:JSON.parse(options.body)}
    return {ok:true,json:async()=>({exclusions:{rules:[{category:'domain',operator:'exclude',value:'construction',unit:'',evaluation:'deterministic',originalText:'no construction'}]}})}
  }
  const result=await requestSearchProfileExclusions({exclusionsText:'No construction',fetchImpl})
  assert.equal(seen.url,'/api/search-profile')
  assert.deepEqual(seen.body,{mode:'exclusions',exclusionsText:'No construction'})
  assert.equal(result.rules.length,1)
})
