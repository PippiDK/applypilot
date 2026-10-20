import test from 'node:test'
import assert from 'node:assert/strict'
import {sortLiveMatchesByScore,formatLiveMatchScore} from './live-match-sort.js'
const make=(score,date,id)=>({job:{sourceJobId:id,publishedAt:date},evaluation:{score}})
test('highest numeric score precedes freshness and maintains input snapshot',()=>{
 const rows=[make(7.3,'2026-10-20','low'),make(9.6,'2026-10-16','high'),make(8.4,'2026-10-19','medium')]
 const sorted=sortLiveMatchesByScore(rows)
 assert.deepEqual(sorted.map(x=>x.job.sourceJobId),['high','medium','low'])
 assert.equal(rows[0].job.sourceJobId,'low')
})
test('equal score sorts newest publication first',()=>{
 const rows=[make(8.4,'2026-10-16','older'),make(8.4,'2026-10-20','newer')]
 assert.deepEqual(sortLiveMatchesByScore(rows).map(x=>x.job.sourceJobId),['newer','older'])
})
test('numeric labels use audit score units',()=>{
 assert.equal(formatLiveMatchScore(9.6),'9.6/10')
 assert.equal(formatLiveMatchScore(8.4),'8.4/10')
 assert.equal(formatLiveMatchScore(7.3),'7.3/10')
 assert.equal(formatLiveMatchScore(9.1),'9.1/10')
 assert.equal(formatLiveMatchScore(6.9),'6.9/10')
})
