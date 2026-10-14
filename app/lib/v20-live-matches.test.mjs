import test from 'node:test'
import assert from 'node:assert/strict'
import {combineImportedAndSearchItems,importedJobsToLiveItems} from './v20-live-matches.js'

const make=(id,extra={})=>({sourceJobId:id,jobId:'linkedin:'+id,source:'linkedin',title:'Implementation Manager',company:'Trackunit',location:'Copenhagen, Denmark',url:`https://www.linkedin.com/jobs/view/${id}/`,fullJd:'A'.repeat(160),jdStatus:'complete',...extra})

test('no real date: job remains visible and its score is not invented',()=>{
  const rows=importedJobsToLiveItems([make('4475956666')],{},3)
  assert.equal(rows.length,1)
  assert.equal(rows[0].evaluation.score,null)
  assert.equal(rows[0].job.sourceJobId,'4475956666')
})
test('partial descriptions still enter same Live Matches shape',()=>{
  const rows=importedJobsToLiveItems([make('4475956665',{fullJd:'A'.repeat(155)+'[remainder of source sentence missing]'})],{},3)
  assert.equal(rows.length,1)
  assert.equal(rows[0].job.needsJdReview,true)
})
test('repeated search result with same LinkedIn ID does not duplicate import',()=>{
  const imported=importedJobsToLiveItems([make('4475956666')],{},3)
  const existing=[{job:{source:'linkedin',sourceJobId:'4475956666'},evaluation:{score:8}}, {job:{source:'jobindex',sourceJobId:'other'},evaluation:{score:7}}]
  const joined=combineImportedAndSearchItems(imported,existing)
  assert.equal(joined.length,2)
  assert.equal(joined[0].job.importLabel,'LinkedIn Import')
})
test('other sources remain unchanged',()=>{
  const jobindex={job:{source:'jobindex',sourceJobId:'abc'},evaluation:{score:8.1}}
  assert.equal(combineImportedAndSearchItems([], [jobindex])[0],jobindex)
})
