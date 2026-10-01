import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FRESHNESS_OPTIONS,
  freshnessRequestDays,
  freshnessResultLabel,
  freshnessSelectionFromDays,
  filterItemsByFreshnessSelection,
} from './freshness-selection.js'

const item=(id,publishedAt)=>({job:{sourceJobId:id,publishedAt}})
const ids=items=>items.map(entry=>entry.job.sourceJobId)

const NOW=new Date('2026-09-03T10:00:00.000Z') // 12:00 in Copenhagen

test('exposes professional intensive-search cadence labels',()=>{
  assert.deepEqual(FRESHNESS_OPTIONS.map(({id,label})=>({id,label})),[
    {id:'today',label:'1 Day'},
    {id:'yesterday',label:'3 Days'},
    {id:'5d',label:'5 Days'},
    {id:'10d',label:'10 Days'},
  ])
  assert.equal(freshnessRequestDays('today'),1)
  assert.equal(freshnessRequestDays('yesterday'),3)
  assert.equal(freshnessRequestDays('5d'),5)
  assert.equal(freshnessRequestDays('10d'),10)
})

test('maps the 1 3 5 10 controls to rolling freshness semantics',()=>{
  assert.equal(freshnessSelectionFromDays(1),'today')
  assert.equal(freshnessSelectionFromDays(3),'yesterday')
  assert.equal(freshnessSelectionFromDays(5),'5d')
  assert.equal(freshnessSelectionFromDays(7),'5d')
  assert.equal(freshnessSelectionFromDays(10),'10d')
  assert.equal(freshnessSelectionFromDays(14),'10d')
})

test('Today keeps only the current Copenhagen calendar day',()=>{
  const jobs=[
    item('today-early','2026-09-02T22:05:00.000Z'), // 00:05 Sep 3 CPH
    item('yesterday-late','2026-09-02T21:55:00.000Z'), // 23:55 Sep 2 CPH
  ]
  assert.deepEqual(ids(filterItemsByFreshnessSelection(jobs,'today',NOW)),['today-early'])
})

test('3 day mode keeps jobs within a rolling three-day horizon',()=>{
  const jobs=[
    item('today','2026-09-03T06:00:00.000Z'),
    item('2d23h','2026-08-31T11:00:00.000Z'),
    item('3d01h','2026-08-31T09:00:00.000Z'),
  ]
  assert.deepEqual(ids(filterItemsByFreshnessSelection(jobs,'yesterday',NOW)),['today','2d23h'])
})

test('5 and 10 day modes cap visible results to their actual rolling horizon',()=>{
  const jobs=[
    item('4d23h','2026-08-29T11:00:00.000Z'),
    item('5d01h','2026-08-29T09:00:00.000Z'),
    item('9d23h','2026-08-24T11:00:00.000Z'),
    item('10d01h','2026-08-24T09:00:00.000Z'),
  ]
  assert.deepEqual(ids(filterItemsByFreshnessSelection(jobs,'5d',NOW)),['4d23h'])
  assert.deepEqual(ids(filterItemsByFreshnessSelection(jobs,'10d',NOW)),['4d23h','5d01h','9d23h'])
})

test('result labels use the same professional wording',()=>{
  assert.equal(freshnessResultLabel('today'),'1 Day')
  assert.equal(freshnessResultLabel('yesterday'),'Newest 3 Days')
  assert.equal(freshnessResultLabel('5d'),'Newest 5 Days')
  assert.equal(freshnessResultLabel('10d'),'Newest 10 Days')
})
