import test from 'node:test'
import assert from 'node:assert/strict'
import {candidateRowsForUpsert,processedRowPatch,composeSearchRunResult} from './search-run-store.js'

const directionA={key:'technical project manager',role:'Technical Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}
const directionB={key:'it project manager',role:'IT Project Manager',tier:'primary',origin:'cv',cvSlots:[1]}

test('candidate upsert rows keep one job identity and merged foundBy provenance',()=>{
  const rows=candidateRowsForUpsert('run-1',[{jobId:'4457919297',title:'Technical Project Manager',foundBy:[directionA,directionB]}])
  assert.equal(rows.length,1)
  assert.equal(rows[0].run_id,'run-1')
  assert.equal(rows[0].job_id,'4457919297')
  assert.deepEqual(rows[0].found_by,[directionA,directionB])
  assert.equal(rows[0].detail_status,'PENDING')
})

test('processed row patch persists evaluation and audit without changing candidate identity',()=>{
  const patch=processedRowPatch({candidate:{jobId:'4457919297'},detailStatus:'PROCESSED',job:{title:'Technical Project Manager'},evaluation:{score:9.1},audit:{stage:'KEPT',decision:'KEEP',score:91},error:null})
  assert.equal(patch.detail_status,'PROCESSED')
  assert.equal(patch.job.title,'Technical Project Manager')
  assert.equal(patch.evaluation.score,9.1)
  assert.equal(patch.audit.stage,'KEPT')
})

test('compose result exposes kept jobs audit and access-limited coverage from persisted candidates',()=>{
  const run={id:'run-1',status:'ACCESS_LIMITED',freshness_days:7,stats:{discovered:2},coverage:{status:'ACCESS LIMITED'}}
  const rows=[
    {job_id:'1',detail_status:'PROCESSED',job:{sourceJobId:'1',title:'A'},evaluation:{score:9},audit:{stage:'KEPT',decision:'KEEP'}},
    {job_id:'2',detail_status:'UNVERIFIED',job:null,evaluation:null,audit:{stage:'DETAIL_FETCH_FAILED',decision:'UNVERIFIED'}},
  ]
  const result=composeSearchRunResult(run,rows)
  assert.equal(result.jobs.length,1)
  assert.equal(result.audit.length,2)
  assert.equal(result.coverage.status,'ACCESS LIMITED')
  assert.equal(result.stats.fullJdProcessed,2)
})
