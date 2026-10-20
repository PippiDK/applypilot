import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createNightFlightProcessedMatcher,enrichSearchJobsWithNightFlight} from './night-flight-main-search-bridge.js'
import {resolveJobStatus} from './job-statuses.js'
import {filterByVisibleProvenance} from './v20-provenance-visibility.js'

const item=(id,extras={})=>({job:{source:'linkedin',sourceJobId:id,title:'Example role',company:'Example',...extras},evaluation:{score:82}})
const nfIndex={jobs:{'linkedin:2222222':{processed:true,source:'linkedin'},'linkedin:3333333':{processed:false}}}
const imported=item('1111111',{importSource:'linkedin-json'})
const night=item('2222222')
const ordinary=item('3333333')
const locallyMarked=item('4444444',{nightFlight:{processed:true}})
const both=item('2222222',{importSource:'linkedin-json'})
const all=[imported,night,ordinary,locallyMarked]
const isNightFlightJob=createNightFlightProcessedMatcher(nfIndex)
const filter=(options)=>filterByVisibleProvenance(all,{...options,isNightFlightJob})

test('reproduces LIVE discrepancy: derived NIGHT FLIGHT with no local flag is hidden when unchecked',()=>{
 assert.equal(night.job.nightFlight,undefined)
 const enriched=enrichSearchJobsWithNightFlight([night],nfIndex)[0]
 assert.equal(resolveJobStatus({manualStatus:'',job:enriched.job}),'night-flight')
 assert.equal(isNightFlightJob(night.job),true)
 assert.deepEqual(filter({showNightPilot:false}).map(i=>i.job.sourceJobId),['1111111','3333333'])
})
test('both special filters checked show every item; unchecking Imported only excludes imports',()=>{
 assert.deepEqual(filter({}).map(i=>i.job.sourceJobId),['1111111','2222222','3333333','4444444'])
 assert.deepEqual(filter({showImported:false}).map(i=>i.job.sourceJobId),['2222222','3333333','4444444'])
})
test('both unchecked leave only normal search; overlapping imported and Night Flight excludes on either',()=>{
 assert.deepEqual(filter({showImported:false,showNightPilot:false}).map(i=>i.job.sourceJobId),['3333333'])
 assert.equal(filterByVisibleProvenance([both],{showImported:false,isNightFlightJob}).length,0)
 assert.equal(filterByVisibleProvenance([both],{showNightPilot:false,isNightFlightJob}).length,0)
})
test('the Night Flight filter hides independently of manual application status and leaves items untouched',()=>{
 const snapshot=structuredClone(all)
 const filtered=filter({showNightPilot:false})
 assert.deepEqual(all,snapshot)
 assert.equal(filtered[0],imported)
 assert.equal(filtered[0].evaluation.score,82)
})
test('bridge predicate accepts exact URL fallback but rejects unprocessed and fuzzy title/company matches',()=>{
 const idx={jobs:{'server-key':{processed:true,job:{originalUrl:'https://www.linkedin.com/jobs/view/9876543'}}}}
 const matcher=createNightFlightProcessedMatcher(idx)
 assert.equal(matcher({source:'linkedin',originalUrl:'https://www.linkedin.com/jobs/view/9876543/?ref=abc'}),true)
 assert.equal(matcher({source:'linkedin',sourceJobId:'3333333'}),false)
 assert.equal(matcher({source:'linkedin',title:'Example role',company:'Example'}),false)
})
test('the production page passes the same Night Flight predicate into base filters and counts',()=>{
 const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
 const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
 assert.match(page,/createNightFlightProcessedMatcher\(nightFlightIndex\)/)
 assert.match(page,/MainSearchBase\(\{isNightFlightJob\}\)/)
 assert.match(main,/filterByVisibleProvenance\(v20VisibleByWindow\(jobs,freshnessDays\),\{showImported,showNightPilot,isNightFlightJob\}\)/)
 assert.match(main,/jobs\.filter\(item=>isNightFlightJob\(item\?\.job\)\)\.length/)
})
