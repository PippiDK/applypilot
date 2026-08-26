import test from 'node:test'
import assert from 'node:assert/strict'
import {compareShadowToLegacy} from './shadow-search-compare.js'

test('compares against all legacy audit IDs and partitions new candidates without double counting',()=>{
  const result=compareShadowToLegacy({
    legacyAudit:[{jobId:'1'},{jobId:'2'}],
    candidates:[
      {jobId:'1',foundBy:[{tier:'primary'}]},
      {jobId:'3',foundBy:[{tier:'primary'},{tier:'adjacent'}]},
      {jobId:'4',foundBy:[{tier:'adjacent'}]}
    ]
  })
  assert.equal(result.totalCandidates,3)
  assert.equal(result.alreadyDiscovered,1)
  assert.equal(result.newCount,2)
  assert.equal(result.newFromPrimary,1)
  assert.equal(result.newFromAdjacent,1)
  assert.deepEqual(result.newCandidates.map(candidate=>candidate.jobId),['3','4'])
  assert.equal(result.newFromPrimary+result.newFromAdjacent,result.newCount)
})

test('accepts legacy audit sourceJobId and ignores invalid IDs',()=>{
  const result=compareShadowToLegacy({
    legacyAudit:[{sourceJobId:'7'},{}],
    candidates:[{jobId:'7',foundBy:[]},{jobId:'8',foundBy:[]},{}]
  })
  assert.equal(result.totalCandidates,2)
  assert.equal(result.alreadyDiscovered,1)
  assert.equal(result.newCount,1)
  assert.equal(result.newFromPrimary,0)
  assert.equal(result.newFromAdjacent,1)
})
