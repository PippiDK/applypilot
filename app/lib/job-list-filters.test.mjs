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

test('classifies agreed work-model buckets',()=>{
  assert.equal(classifyWorkModel({location:'Copenhagen, Denmark',country:'Denmark',remoteType:'hybrid'}),'dk_hybrid')
  assert.equal(classifyWorkModel({location:'Ballerup, Denmark',country:'Denmark',remoteType:'onsite'}),'dk_onsite')
  assert.equal(classifyWorkModel({location:'Denmark',country:'Denmark',remoteType:'remote'}),'dk_remote')
  assert.equal(classifyWorkModel({location:'Europe',country:'',remoteType:'remote',remoteEligibility:'DENMARK CONFIRMED'}),'eu_remote_denmark')
})

test('filters only the already-found items and keeps selected remote buckets independent of physical area',()=>{
  const items=[
    {job:{sourceJobId:'1',location:'Nærum, Denmark',country:'Denmark',remoteType:'hybrid'}},
    {job:{sourceJobId:'2',location:'Ballerup, Denmark',country:'Denmark',remoteType:'hybrid'}},
    {job:{sourceJobId:'3',location:'Europe',remoteType:'remote',remoteEligibility:'DENMARK CONFIRMED'}},
  ]
  const result=filterJobItems(items,['copenhagen_north'],['dk_hybrid','eu_remote_denmark'])
  assert.deepEqual(result.map(item=>item.job.sourceJobId),['1','3'])
})

test('all selected is a no-op for the existing pool, including unclassified jobs',()=>{
  const items=[{job:{sourceJobId:'x',location:'Somewhere',remoteType:'unknown'}}]
  assert.equal(filterJobItems(items,SEARCH_AREAS.map(x=>x.id),WORK_MODELS.map(x=>x.id)).length,1)
})
