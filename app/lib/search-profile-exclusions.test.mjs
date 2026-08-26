import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSearchProfileExclusions,validateSearchProfileExclusions} from './search-profile-ai.js'

test('parses arbitrary exclusions in one structured AI call',async()=>{
  let calls=0
  let seenInput=null
  const modelCall=async args=>{
    calls++
    seenInput=args.input
    return {rules:[
      {category:'language_requirement',operator:'exclude_if_required',value:'Danish',unit:'',evaluation:'deterministic',originalText:'mandatory Danish'},
      {category:'people_management',operator:'exclude',value:'people management',unit:'',evaluation:'deterministic',originalText:'no people management'},
      {category:'travel',operator:'max',value:'20',unit:'percent',evaluation:'deterministic',originalText:'travel max 20%'},
      {category:'domain',operator:'exclude',value:'construction',unit:'',evaluation:'deterministic',originalText:'no construction'}
    ]}
  }
  const source='No mandatory Danish; no people management; travel max 20%; no construction'
  const result=await buildSearchProfileExclusions({exclusionsText:source,modelCall})
  assert.equal(calls,1)
  assert.equal(seenInput.exclusionsText,source)
  assert.equal(result.rules.length,4)
  assert.equal(result.rules[0].operator,'exclude_if_required')
  assert.equal(result.rules[2].unit,'percent')
})

test('blank exclusions use zero AI calls',async()=>{
  let calls=0
  const result=await buildSearchProfileExclusions({exclusionsText:'   ',modelCall:async()=>{calls++;return {rules:[]}}})
  assert.equal(calls,0)
  assert.deepEqual(result,{rules:[]})
})

test('validator keeps only valid unique structured rules',()=>{
  const result=validateSearchProfileExclusions({rules:[
    {category:'domain',operator:'exclude',value:'Construction',unit:'',evaluation:'deterministic',originalText:'No construction'},
    {category:'domain',operator:'exclude',value:'construction',unit:'',evaluation:'deterministic',originalText:'construction'},
    {category:'unknown',operator:'exclude',value:'x',unit:'',evaluation:'deterministic',originalText:'x'}
  ]})
  assert.equal(result.rules.length,1)
  assert.equal(result.rules[0].value,'Construction')
})
