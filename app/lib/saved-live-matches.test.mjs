import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeSavedLiveMatches,readSavedLiveMatches,writeSavedLiveMatches,liveMatchIdentity,LIVE_MATCHES_STORAGE_KEY} from './saved-live-matches.js'
const now='2026-10-19T12:00:00.000Z'
const make=(id,publishedAt='2026-10-18T12:00:00.000Z',score=.8)=>({job:{source:'linkedin',sourceJobId:id,title:'Project Manager',company:'Example',location:'Denmark',publishedAt},evaluation:{score}})
test('previous matches remain and newly matched jobs append without duplication',()=>{
  const first=mergeSavedLiveMatches([],[make('100')],now)
  assert.equal(first.length,1)
  const next=mergeSavedLiveMatches(first,[make('200'),make('100')],now)
  assert.equal(next.length,2)
  assert.deepEqual(next.map(r=>r.item.job.sourceJobId),['100','200'])
  assert.equal(liveMatchIdentity(make('100')),liveMatchIdentity(make('100')))
})
test('repeat finding refreshes evaluation',()=>{
  const first=mergeSavedLiveMatches([],[make('100')],now)
  const changed=mergeSavedLiveMatches(first,[make('100','2026-10-18T12:00:00.000Z',.95)],now)
  assert.equal(changed[0].item.evaluation.score,.95)
})
test('ten-day expiry is based on publishedAt, not first seen',()=>{
  assert.equal(mergeSavedLiveMatches([],[make('old','2026-10-09T11:59:00.000Z')],now).length,0)
  assert.equal(mergeSavedLiveMatches([],[make('fresh','2026-10-09T12:01:00.000Z')],now).length,1)
})
test('unrated jobs and missing publication dates never enter saved match pool',()=>{
  assert.equal(mergeSavedLiveMatches([],[make('unrated','2026-10-18T12:00:00.000Z',null),make('undated',null)],now).length,0)
})
test('browser reload restores and prunes expired jobs',()=>{
  const data=new Map()
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}
  const pool=mergeSavedLiveMatches([],[make('100')],now)
  writeSavedLiveMatches(storage,pool)
  assert.ok(data.has(LIVE_MATCHES_STORAGE_KEY))
  assert.equal(readSavedLiveMatches(storage,now).length,1)
  assert.equal(readSavedLiveMatches(storage,'2026-10-30T12:00:00.000Z').length,0)
})
