import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSearchProfileRoles,validateSearchProfileRoles} from './search-profile-ai.js'

const CV=`Senior IT Delivery Manager with 18+ years of experience leading end-to-end technology delivery, software platforms, integrations, governance, Agile and hybrid delivery across global organisations. Senior Project Manager at Cobham Satcom. Senior IT Delivery Manager at Saxo Bank.`

test('validates primary and adjacent role suggestions',()=>{
  const value=validateSearchProfileRoles({
    primaryRoles:['Senior Project Manager','Delivery Manager','Technical Project Manager'],
    adjacentRoles:['Implementation Project Manager','Transformation Project Manager']
  })
  assert.deepEqual(value.primaryRoles,['Senior Project Manager','Delivery Manager','Technical Project Manager'])
  assert.deepEqual(value.adjacentRoles,['Implementation Project Manager','Transformation Project Manager'])
})

test('rejects empty primary roles',()=>{
  assert.throws(()=>validateSearchProfileRoles({primaryRoles:[],adjacentRoles:[]}),/primary role/i)
})

test('builds roles from CV 1 in one structured AI call',async()=>{
  let calls=0
  let seenInput=null
  const modelCall=async args=>{
    calls++
    seenInput=args.input
    return {
      primaryRoles:['Senior Project Manager','Delivery Manager'],
      adjacentRoles:['Technical Project Manager','Implementation Project Manager']
    }
  }
  const result=await buildSearchProfileRoles({cvText:CV,modelCall})
  assert.equal(calls,1)
  assert.equal(seenInput.sourceCv,CV)
  assert.deepEqual(result.primaryRoles,['Senior Project Manager','Delivery Manager'])
  assert.deepEqual(result.adjacentRoles,['Technical Project Manager','Implementation Project Manager'])
})

test('removes duplicate role names case-insensitively',()=>{
  const value=validateSearchProfileRoles({
    primaryRoles:['Delivery Manager','delivery manager','Senior Project Manager'],
    adjacentRoles:['Senior Project Manager','Implementation Project Manager']
  })
  assert.deepEqual(value.primaryRoles,['Delivery Manager','Senior Project Manager'])
  assert.deepEqual(value.adjacentRoles,['Implementation Project Manager'])
})
