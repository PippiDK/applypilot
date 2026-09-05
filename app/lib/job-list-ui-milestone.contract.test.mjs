import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../globals.css',import.meta.url),'utf8')
let statusHelper=''
try{ statusHelper=fs.readFileSync(new URL('./job-statuses.js',import.meta.url),'utf8') }catch{}

test('manual job statuses are local informational metadata with three explicit states',()=>{
  assert.match(statusHelper,/JOB_STATUS_STORAGE_KEY/)
  assert.match(statusHelper,/applied/)
  assert.match(statusHelper,/considering/)
  assert.match(statusHelper,/ignore/)
  assert.match(page,/JOB_STATUS_OPTIONS/)
  assert.match(page,/readJobStatuses/)
  assert.match(page,/writeJobStatus/)
  assert.match(page,/jobStatuses/)
  assert.match(page,/jobStatusSelect/)
  assert.match(css,/\.jobStatusSelect/)
  assert.match(css,/\.status-applied/)
  assert.match(css,/\.status-considering/)
  assert.match(css,/\.status-ignore/)
})

test('manual job statuses never enter search requests and only filter the post-search list',()=>{
  const searchStart=page.indexOf('async function search(){')
  const searchEnd=page.indexOf('\n  function startProfile()',searchStart)
  assert.ok(searchStart>=0&&searchEnd>searchStart,'search() block must be found')
  const searchBlock=page.slice(searchStart,searchEnd)
  const requestBodies=[...searchBlock.matchAll(/body:JSON\.stringify\(([^\n]+|\{[\s\S]*?\})\)/g)].map(match=>match[0]).join('\n')
  assert.doesNotMatch(requestBodies,/jobStatuses|JOB_STATUS_FILTERS|selectedStatuses/)
  assert.match(page,/filterJobItemsByStatus\(filterJobItems\(/)
})

test('Area, Employment type and Work model render directly under the vacancy header before Best CV',()=>{
  const header=page.indexOf('panelTop expertiseHeader')
  const conditions=page.indexOf('<div className="conditionGrid">')
  const best=page.indexOf('<BestCvPanel')
  assert.ok(header>=0,'vacancy header is missing')
  assert.ok(conditions>header,'condition cards must render below the vacancy header')
  assert.ok(best>conditions,'condition cards must render before Best CV')
  const conditionBlock=page.slice(conditions,best)
  assert.match(conditionBlock,/>Area</)
  assert.match(conditionBlock,/>Employment type</)
  assert.match(conditionBlock,/>Work model</)
})

test('All filters is the first filter row and controls only Search Areas and Work Model',()=>{
  const allFilters=page.indexOf('>All filters</span>')
  const searchAreas=page.indexOf('>SEARCH AREAS</small>')
  assert.ok(allFilters>=0,'All filters row is missing')
  assert.ok(searchAreas>allFilters,'All filters must render before Search Areas')
  assert.match(page,/checked=\{allFiltersSelected\}/)
  assert.match(page,/node\.indeterminate=someFiltersSelected&&!allFiltersSelected/)
  assert.match(page,/onChange=\{toggleAllJobFilters\}/)
  const handlerStart=page.indexOf('function toggleAllJobFilters(')
  const handlerEnd=page.indexOf('\n  }',handlerStart)+4
  const handler=page.slice(handlerStart,handlerEnd)
  assert.match(handler,/setSelectedAreas\(checked\?SEARCH_AREAS\.map\(\(\{id\}\)=>id\):\[\]\)/)
  assert.match(handler,/setSelectedWorkModels\(checked\?WORK_MODELS\.map\(\(\{id\}\)=>id\):\[\]\)/)
  assert.doesNotMatch(handler,/setSelectedStatuses/)
})

test('Status is a third independent filter group and replaces Show ignored',()=>{
  const workModel=page.indexOf('>WORK MODEL</small>')
  const status=page.indexOf('>STATUS</small>')
  assert.ok(workModel>=0,'Work Model group is missing')
  assert.ok(status>workModel,'Status must render after Work Model')
  assert.match(page,/JOB_STATUS_FILTERS\.map/)
  assert.match(page,/selectedStatuses\.includes/)
  assert.match(page,/setSelectedStatuses/)
  assert.doesNotMatch(page,/>Show ignored</)
})
