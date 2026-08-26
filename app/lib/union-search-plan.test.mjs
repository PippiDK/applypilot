import test from 'node:test'
import assert from 'node:assert/strict'
import {buildUnionSearchPlan,UNION_SEARCH_PLAN_VERSION} from './union-search-plan.js'

const roleSources=[
  {
    role:'Senior IT Project Manager',
    cvIds:['cv-1','cv-2'],
    support:[{cvId:'cv-1',kind:'primary'},{cvId:'cv-2',kind:'adjacent'}]
  },
  {
    role:'Release Manager',
    cvIds:['cv-3'],
    support:[{cvId:'cv-3',kind:'adjacent'}]
  },
  {
    role:'Legacy Test Manager',
    cvIds:['cv-1'],
    support:[{cvId:'cv-1',kind:'adjacent'}]
  }
]

const cvRoleProfiles=[
  {cvId:'cv-1',slot:1,fileName:'general.pdf'},
  {cvId:'cv-2',slot:2,fileName:'finance.pdf'},
  {cvId:'cv-3',slot:3,fileName:'consultant.pdf'}
]

test('compiles edited roles in primary-then-adjacent order and primary wins duplicates',()=>{
  const plan=buildUnionSearchPlan({
    primaryRoles:['Senior IT Project Manager','Execution Lead'],
    adjacentRoles:[' execution   lead ','Release Manager'],
    roleSources,
    cvRoleProfiles
  })
  assert.equal(plan.version,UNION_SEARCH_PLAN_VERSION)
  assert.equal(plan.primaryCount,2)
  assert.equal(plan.adjacentCount,1)
  assert.equal(plan.totalCount,3)
  assert.deepEqual(plan.directions.map(item=>[item.role,item.tier,item.origin]),[
    ['Senior IT Project Manager','primary','cv'],
    ['Execution Lead','primary','manual'],
    ['Release Manager','adjacent','cv']
  ])
})

test('removed raw CV-proposed roles do not survive the edited plan',()=>{
  const plan=buildUnionSearchPlan({
    primaryRoles:['Senior IT Project Manager'],
    adjacentRoles:[],
    roleSources,
    cvRoleProfiles
  })
  assert.equal(plan.directions.some(item=>item.role==='Legacy Test Manager'),false)
})

test('manual roles are preserved without invented CV provenance',()=>{
  const plan=buildUnionSearchPlan({
    primaryRoles:['Execution Lead'],
    adjacentRoles:[],
    roleSources,
    cvRoleProfiles
  })
  assert.deepEqual(plan.directions[0],{
    key:'execution lead',
    role:'Execution Lead',
    tier:'primary',
    origin:'manual',
    cvIds:[],
    cvSlots:[],
    support:[]
  })
})

test('CV-supported roles preserve all supporting CV ids, slots and raw support kinds',()=>{
  const plan=buildUnionSearchPlan({
    primaryRoles:['Senior IT Project Manager'],
    adjacentRoles:[],
    roleSources,
    cvRoleProfiles
  })
  assert.deepEqual(plan.directions[0],{
    key:'senior it project manager',
    role:'Senior IT Project Manager',
    tier:'primary',
    origin:'cv',
    cvIds:['cv-1','cv-2'],
    cvSlots:[1,2],
    support:[{cvId:'cv-1',kind:'primary'},{cvId:'cv-2',kind:'adjacent'}]
  })
})

test('user retiering changes plan tier while preserving original CV support classification',()=>{
  const plan=buildUnionSearchPlan({
    primaryRoles:['Release Manager'],
    adjacentRoles:[],
    roleSources,
    cvRoleProfiles
  })
  assert.equal(plan.directions[0].tier,'primary')
  assert.deepEqual(plan.directions[0].support,[{cvId:'cv-3',kind:'adjacent'}])
})

test('deduplicates case and whitespace while preserving first visible spelling',()=>{
  const plan=buildUnionSearchPlan({
    primaryRoles:['  Technical   Project Manager ','technical project manager'],
    adjacentRoles:['TECHNICAL PROJECT MANAGER','Client Delivery Manager',' client   delivery manager '],
    roleSources:[],
    cvRoleProfiles:[]
  })
  assert.deepEqual(plan.directions.map(item=>item.role),['Technical Project Manager','Client Delivery Manager'])
  assert.deepEqual(plan.directions.map(item=>item.tier),['primary','adjacent'])
})

test('empty edited lists produce an empty valid plan',()=>{
  const plan=buildUnionSearchPlan({roleSources,cvRoleProfiles})
  assert.equal(plan.primaryCount,0)
  assert.equal(plan.adjacentCount,0)
  assert.equal(plan.totalCount,0)
  assert.deepEqual(plan.directions,[])
  assert.match(plan.fingerprint,/^usp1-/)
})

test('fingerprint is stable for identical execution inputs',()=>{
  const input={primaryRoles:['A','B'],adjacentRoles:['C'],roleSources:[],cvRoleProfiles:[]}
  assert.equal(buildUnionSearchPlan(input).fingerprint,buildUnionSearchPlan(input).fingerprint)
})

test('fingerprint changes on add remove reorder retier or provenance change',()=>{
  const base=buildUnionSearchPlan({primaryRoles:['A','B'],adjacentRoles:['C'],roleSources:[],cvRoleProfiles:[]}).fingerprint
  const variants=[
    buildUnionSearchPlan({primaryRoles:['A','B','D'],adjacentRoles:['C'],roleSources:[],cvRoleProfiles:[]}).fingerprint,
    buildUnionSearchPlan({primaryRoles:['A'],adjacentRoles:['C'],roleSources:[],cvRoleProfiles:[]}).fingerprint,
    buildUnionSearchPlan({primaryRoles:['B','A'],adjacentRoles:['C'],roleSources:[],cvRoleProfiles:[]}).fingerprint,
    buildUnionSearchPlan({primaryRoles:['A'],adjacentRoles:['B','C'],roleSources:[],cvRoleProfiles:[]}).fingerprint,
    buildUnionSearchPlan({
      primaryRoles:['A','B'],adjacentRoles:['C'],
      roleSources:[{role:'A',cvIds:['cv-1'],support:[{cvId:'cv-1',kind:'primary'}]}],
      cvRoleProfiles:[{cvId:'cv-1',slot:1}]
    }).fingerprint
  ]
  for(const fingerprint of variants) assert.notEqual(fingerprint,base)
})
