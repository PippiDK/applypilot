import test from 'node:test'
import assert from 'node:assert/strict'
import {filterItemsByFreshnessSelection,freshnessSelectionFromDays} from './freshness-selection.js'
import {sortLiveMatchesByScore} from './live-match-sort.js'
import {mergeSavedLiveMatches,savedLiveMatchItems} from './saved-live-matches.js'
const now=new Date('2026-10-20T10:00:00.000Z')
const job=(id,date,score)=>({job:{source:'linkedin',sourceJobId:id,title:'Project '+id,company:'Example',publishedAt:date},evaluation:{score}})
const today=job('today','2026-10-20T06:00:00.000Z',8.2)
const yesterday=job('yesterday','2026-10-19T09:00:00.000Z',9.6)
const fourDays=job('four','2026-10-16T09:00:00.000Z',7.5)
test('one-day UI filters the 10-day archive without erasing older retained jobs',()=>{
 const archived=mergeSavedLiveMatches([], [today,yesterday,fourDays], now.toISOString())
 assert.equal(archived.length,3)
 const items=savedLiveMatchItems(archived)
 const shown=sortLiveMatchesByScore(filterItemsByFreshnessSelection(items,freshnessSelectionFromDays(1),now))
 assert.deepEqual(shown.map(x=>x.job.sourceJobId),['today'])
 assert.equal(archived.length,3)
 assert.deepEqual(sortLiveMatchesByScore(filterItemsByFreshnessSelection(items,freshnessSelectionFromDays(5),now)).map(x=>x.job.sourceJobId),['yesterday','today','four'])
})
test('only change selected view; underlying saved rows remain available for ten-day view',()=>{
 const items=[today,yesterday,fourDays]
 assert.equal(filterItemsByFreshnessSelection(items,freshnessSelectionFromDays(10),now).length,3)
 assert.equal(filterItemsByFreshnessSelection(items,freshnessSelectionFromDays(3),now).length,2)
})
