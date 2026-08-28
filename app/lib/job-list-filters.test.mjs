import test from 'node:test'
import assert from 'node:assert/strict'
import {SEARCH_AREAS,WORK_MODELS,classifySearchArea,classifyWorkModel,filterJobItems} from './job-list-filters.js'

test('maps representative Danish locations into agreed search areas',()=>{
  assert.equal(classifySearchArea({location:'Nærum, Capital Region of Denmark'}),'copenhagen_north')
  assert.equal(classifySearchArea({location:'Ballerup, Capital Region of Denmark'}),'greater_copenhagen')
  assert.equal(classifySearchArea({location:'Aarhus, Central Denmark Region'}),'aarhus_east_jutland')
  assert.equal(classifySearchArea({location:'Nordborg, Region of Southern Denmark'}),'south_jutland')
  assert.equal(classifySearchArea({location:'Odense, Region of Southern Denmark'}),'funen')
})

test('classifies existing filter buckets without changing search data',()=>{
  assert.equal(classifyWorkModel({location:'Copenhagen, Denmark',country:'Denmark',remoteType:'hybrid'}),'dk_hybrid')
  assert.equal(classifyWorkModel({location:'Ballerup, Denmark',country:'Denmark',remoteType:'onsite'}),'dk_onsite')
  assert.equal(classifyWorkModel({location:'Denmark',country:'Denmark',remoteType:'remote'}),'dk_remote')
  assert.equal(classifyWorkModel({location:'Europe',country:'',remoteType:'remote',remoteEligibility:'DENMARK CONFIRMED'}),'eu_remote_denmark')
})

test('exposes three work models plus two remote scopes in UI order',()=>{
  assert.deepEqual(WORK_MODELS.map(({id,label})=>[id,label]),[
    ['dk_hybrid','Hybrid'],
    ['dk_onsite','On-site'],
    ['remote','Remote'],
    ['dk_remote','Denmark'],
    ['eu_remote_denmark','EU / Europe — available from Denmark'],
  ])
})

test('Remote is a separate work-model switch and remote scope ignores Search Areas',()=>{
  const items=[
    {job:{sourceJobId:'hybrid-naerum',location:'Nærum, Denmark',country:'Denmark',remoteType:'hybrid'}},
    {job:{sourceJobId:'hybrid-ballerup',location:'Ballerup, Denmark',country:'Denmark',remoteType:'hybrid'}},
    {job:{sourceJobId:'remote-dk',location:'Odense, Denmark',country:'Denmark',remoteType:'remote'}},
    {job:{sourceJobId:'remote-eu',location:'Europe',remoteType:'remote',remoteEligibility:'DENMARK CONFIRMED'}},
  ]

  assert.deepEqual(
    filterJobItems(items,['copenhagen_north'],['dk_hybrid']).map(item=>item.job.sourceJobId),
    ['hybrid-naerum']
  )
  assert.deepEqual(
    filterJobItems(items,['copenhagen_north'],['remote','dk_remote']).map(item=>item.job.sourceJobId),
    ['remote-dk']
  )
  assert.deepEqual(
    filterJobItems(items,['copenhagen_north'],['remote','eu_remote_denmark']).map(item=>item.job.sourceJobId),
    ['remote-eu']
  )
  assert.deepEqual(
    filterJobItems(items,['copenhagen_north'],['remote','dk_remote','eu_remote_denmark']).map(item=>item.job.sourceJobId),
    ['remote-dk','remote-eu']
  )
})

test('all selected is a no-op for the existing pool, including unclassified jobs',()=>{
  const items=[{job:{sourceJobId:'x',location:'Somewhere',remoteType:'unknown'}}]
  assert.equal(filterJobItems(items,SEARCH_AREAS.map(x=>x.id),WORK_MODELS.map(x=>x.id)).length,1)
})
