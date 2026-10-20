import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
test('both special filters enabled by default and shown below STATUS',()=>{
 assert.match(main,/\[showImported,setShowImported\]=useState\(true\)/)
 assert.match(main,/\[showNightPilot,setShowNightPilot\]=useState\(true\)/)
 assert.match(main,/checked=\{showImported\}/)
 assert.match(main,/checked=\{showNightPilot\}/)
 assert.match(main,/>Imported<\/span>/)
 assert.match(main,/>Night Pilot<\/span>/)
 assert.doesNotMatch(main,/>SOURCE<\/small>/)
 assert.match(main,/borderTop:'1px solid rgba\(175,132,242,.38\)'/)
})
test('switching off one category hides that category independently without excluding normal Search',()=>{
 const visible=main.match(/const visibleJobs=useMemo\(\(\)=>[^\n]+/)
 assert.ok(visible)
 assert.match(visible[0],/filterByVisibleProvenance\(v20VisibleByWindow\(jobs,freshnessDays\)/)
 assert.match(visible[0],/showImported,showNightPilot,isNightFlightJob/)
 assert.match(main,/jobs\.filter\(item=>isNightFlightJob\(item\?\.job\)\)\.length/)
 assert.match(visible[0],/v20SortedByScore/)
})
