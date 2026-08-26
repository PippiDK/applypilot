import test from 'node:test'
import assert from 'node:assert/strict'
import {requestSearchProfileRoles} from './search-profile-client.js'

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
