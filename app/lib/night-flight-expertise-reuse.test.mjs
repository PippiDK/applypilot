import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveNightFlightExpertise} from './night-flight-expertise-reuse.js'

const index={jobs:{
  'linkedin:4456985138':{
    processed:true,
    source:'linkedin',
    cvSourceVersion:'cv-current',
    matchCacheKey:'nf-cache-1',
    processedAt:'2026-09-07T02:00:00Z',
    analysis:{expertiseMatch:82,whyYouFit:['Delivery'],expertiseGaps:[],breakdown:{}}
  }
}}

test('returns the exact saved Night Flight analysis for the selected exact vacancy identity',()=>{
  const result=resolveNightFlightExpertise({job:{source:'LinkedIn Jobs',sourceJobId:'4456985138'},index,sourceVersion:'cv-current'})
  assert.equal(result,index.jobs['linkedin:4456985138'].analysis)
  assert.equal(result.expertiseMatch,82)
})

test('returns null when Night Flight processed the vacancy but cached analysis is missing',()=>{
  const result=resolveNightFlightExpertise({
    job:{source:'linkedin',sourceJobId:'123'},
    index:{jobs:{'linkedin:123':{processed:true,analysis:null}}}
  })
  assert.equal(result,null)
})

test('never reuses Match for a different vacancy with only similar title/company',()=>{
  const result=resolveNightFlightExpertise({
    job:{title:'Senior Project Manager',company:'Acme',source:'linkedin',sourceJobId:'999'},
    index:{jobs:{'linkedin:777':{processed:true,job:{title:'Senior Project Manager',company:'Acme'},analysis:{expertiseMatch:91}}}}
  })
  assert.equal(result,null)
})


test('F1 does not reuse a saved Night Flight Match from a different CV source version',()=>{
  const result=resolveNightFlightExpertise({
    job:{source:'linkedin',sourceJobId:'4456985138'},
    index,
    sourceVersion:'cv-new',
  })
  assert.equal(result,null)
})
