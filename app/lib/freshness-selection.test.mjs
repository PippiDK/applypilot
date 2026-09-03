import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FRESHNESS_OPTIONS,
  freshnessRequestDays,
  freshnessResultLabel,
  filterItemsByFreshnessSelection,
} from './freshness-selection.js'

const item=(id,publishedAt)=>({job:{sourceJobId:id,publishedAt}})
const ids=items=>items.map(entry=>entry.job.sourceJobId)

const NOW=new Date('2026-09-03T10:00:00.000Z') // 12:00 in Copenhagen

test('exposes intensive-search cadence Today Yesterday 5 days 10 days',()=>{
  assert.deepEqual(FRESHNESS_OPTIONS.map(({id,label})=>({id,label})),[
    {id:'today',label:'Today'},
    {id:'yesterday',label:'Yesterday'},
    {id:'5d',label:'5 days'},
    {id:'10d',label:'10 days'},
  ])
  assert.equal(freshnessRequestDays('today'),1)
  assert.equal(freshnessRequestDays('yesterday'),3)
  assert.equal(freshnessRequestDays('5d'),7)
  assert.equal(freshnessRequestDays('10d'),14)
})

test('Today keeps only the current Copenhagen calendar day',()=>{
  const jobs=[
    item('today-early','2026-09-02T22:05:00.000Z'), // 00:05 Sep 3 CPH
    item('yesterday-late','2026-09-02T21:55:00.000Z'), // 23:55 Sep 2 CPH
  ]
  assert.deepEqual(ids(filterItemsByFreshnessSelection(jobs,'today',NOW)),['today-early'])
})

test('Yesterday keeps only the previous Copenhagen calendar day',()=>{
  const jobs=[
    item('today','2026-09-03T06:00:00.000Z'),
    item('yesterday-morning','2026-09-02T06:00:00.000Z'),
    item('yesterday-late','2026-09-02T21:55:00.000Z'),
    item('two-days-ago','2026-09-01T12:00:00.000Z'),
  ]
  assert.deepEqual(ids(filterItemsByFreshnessSelection(jobs,'yesterday',NOW)),['yesterday-morning','yesterday-late'])
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

test('result labels are human-readable instead of numeric-day boilerplate',()=>{
  assert.equal(freshnessResultLabel('today'),'Today')
  assert.equal(freshnessResultLabel('yesterday'),'Yesterday')
  assert.equal(freshnessResultLabel('5d'),'Newest 5 days')
  assert.equal(freshnessResultLabel('10d'),'Newest 10 days')
})
