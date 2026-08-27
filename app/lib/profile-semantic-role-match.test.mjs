import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateSemanticRoleBatch,PROFILE_SEMANTIC_EVALUATION_VERSION} from './profile-semantic-role-match.js'

test('semantic evaluator version is explicit',()=>{
  assert.equal(PROFILE_SEMANTIC_EVALUATION_VERSION,'profile-semantic-v1')
})

test('empty semantic batch makes zero AI calls',async()=>{
  let calls=0
  const result=await evaluateSemanticRoleBatch({items:[],modelCall:async()=>{calls++;return {results:[]}}})
  assert.equal(calls,0)
  assert.deepEqual(result,[])
})

test('passes Danish and Concept Artist text unchanged to one semantic model call',async()=>{
  let seen=null
  const items=[
    {
      jobId:'dk1',
      title:'IT-projektleder',
      description:'Du leder digitale projekter og samarbejder med udviklingsteams.',
      directions:[{key:'it-pm',role:'Senior IT Project Manager',tier:'primary'}]
    },
    {
      jobId:'art1',
      title:'Senior Concept Artist',
      description:'Create character concepts, environments and visual development for games.',
      directions:[{key:'artist',role:'Concept Artist',tier:'primary'}]
    }
  ]
  const modelCall=async args=>{
    seen=args.input
    return {results:[
      {jobId:'dk1',compatible:true,directionKey:'it-pm',score:91,reason:'Same IT project leadership profession.'},
      {jobId:'art1',compatible:true,directionKey:'artist',score:96,reason:'Direct concept-art role match.'}
    ]}
  }
  const result=await evaluateSemanticRoleBatch({items,modelCall})
  assert.equal(seen.items[0].title,'IT-projektleder')
  assert.match(seen.items[0].description,/digitale projekter/)
  assert.equal(seen.items[1].directions[0].role,'Concept Artist')
  assert.equal(result.length,2)
})

test('rejects a model KEEP that names a direction not supplied for that vacancy',async()=>{
  const items=[{jobId:'1',title:'Artist',description:'Visual art work',directions:[{key:'artist',role:'Concept Artist',tier:'primary'}]}]
  await assert.rejects(
    evaluateSemanticRoleBatch({items,modelCall:async()=>({results:[{jobId:'1',compatible:true,directionKey:'invented',score:90,reason:'x'}]})}),
    /profile_semantic_role_match AI stage failed|Semantic role match response is invalid/
  )
})

test('rejects missing, duplicate, unknown job ids and scores outside 0..100',async()=>{
  const items=[{jobId:'1',title:'Artist',description:'Visual art work',directions:[{key:'artist',role:'Concept Artist',tier:'primary'}]}]
  await assert.rejects(evaluateSemanticRoleBatch({items,modelCall:async()=>({results:[]})}))
  await assert.rejects(evaluateSemanticRoleBatch({items,modelCall:async()=>({results:[{jobId:'1',compatible:true,directionKey:'artist',score:101,reason:'x'}]})}))
  await assert.rejects(evaluateSemanticRoleBatch({items,modelCall:async()=>({results:[
    {jobId:'1',compatible:true,directionKey:'artist',score:90,reason:'x'},
    {jobId:'1',compatible:true,directionKey:'artist',score:90,reason:'x'}
  ]})}))
  await assert.rejects(evaluateSemanticRoleBatch({items,modelCall:async()=>({results:[
    {jobId:'2',compatible:true,directionKey:'artist',score:90,reason:'x'}
  ]})}))
})
