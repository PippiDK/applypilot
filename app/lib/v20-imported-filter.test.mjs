import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
test('Imported filter uses the explicit JSON import marker and is opt-in',()=>{
 assert.match(main,/\[importedOnly,setImportedOnly\]=useState\(false\)/)
 assert.match(main,/!importedOnly\|\|item\?\.job\?\.importSource==='linkedin-json'/)
 assert.match(main,/checked=\{importedOnly\}/)
 assert.match(main,/>Imported<\/span>/)
 assert.match(main,/>Night Pilot<\/span>/)
 assert.doesNotMatch(main,/>SOURCE<\/small>/)
 assert.match(main,/borderTop:'1px solid rgba\(175,132,242,.38\)'/)
})
test('Imported source filter is composed into visibleJobs only, after freshness selection',()=>{
 const visible=main.match(/const visibleJobs=useMemo\(\(\)=>[^\n]+/)
 assert.ok(visible)
 assert.match(visible[0],/v20VisibleByWindow\(jobs,freshnessDays\)\.filter/)
 assert.match(visible[0],/v20SortedByScore/)
 assert.match(visible[0],/nightPilotOnly/)
 assert.match(visible[0],/importedOnly/)
})
