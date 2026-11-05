import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const code=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
test('LIVE 19.1 retained matches are separate from Discovery, Audit and Night Pilot',()=>{
 assert.match(code,/readV19PoolDb\(\)/)
 assert.match(code,/writeV19PoolDb\(livePoolRef\.current\)/)
 assert.match(code,/publishLiveMatches\(mergedJobs\)/)
 assert.match(code,/filterItemsByFreshnessSelection\(jobs,freshnessSelectionFromDays\(freshnessDays\)\)/)
 assert.match(code,/Saved from previous search/)
 assert.match(code,/stroke="#E7B84F"/)
 assert.match(code,/const audit=successful\.flatMap/)
 assert.match(code,/syncAppliedArchive\(\{archive:appliedJobsRef\.current,items:mergedJobs,statuses:jobStatusesRef\.current\}\)/)
 assert.doesNotMatch(code,/from '\.\/lib\/v20-live-pool/)
})
