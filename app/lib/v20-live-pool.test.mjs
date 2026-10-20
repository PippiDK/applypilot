import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeLivePool,readLivePool,writeLivePool,livePoolItems,V20_LIVE_POOL_KEY} from './v20-live-pool.js'

const date='2026-10-14T13:00:00.000Z'
const job=(id,source='linkedin',jd='complete')=>({job:{source,sourceJobId:id,title:'Title '+id,company:'Company',location:'Copenhagen',fullJd:jd,needsJdReview:jd==='short',publishedAt:'2026-10-13T13:00:00.000Z'},evaluation:{score:null,action:'Review'}})
const rated=(id,source='linkedin')=>({...job(id,source),evaluation:{score:8.2,verdict:'High'}})
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}}

test('new search with zero results never erases previous matches',()=>{
  const current=mergeLivePool([], [job('101'),job('102')],date)
  const next=mergeLivePool(current,[], '2026-10-15T13:00:00.000Z')
  assert.equal(next.length,2)
  assert.deepEqual(livePoolItems(next).map(x=>x.job.sourceJobId),['101','102'])
})
test('deduplicates by source and job id without resetting first-seen clock',()=>{
  const current=mergeLivePool([], [job('101')],date)
  const next=mergeLivePool(current,[rated('101')],'2026-10-15T13:00:00.000Z')
  assert.equal(next.length,1)
  assert.equal(next[0].firstSeenAt,date)
  assert.equal(next[0].item.evaluation.score,8.2)
})
test('keeps distinct provider ids even with equal titles and ids',()=>{
  const pool=mergeLivePool([], [job('101','linkedin'),job('101','jobnet')],date)
  assert.equal(pool.length,2)
})
test('drops expired records at 10 days, from publication date',()=>{
  const existing=mergeLivePool([], [job('101')],date)
  assert.equal(mergeLivePool(existing,[],'2026-10-22T13:00:00.000Z').length,1)
  assert.equal(mergeLivePool(existing,[],'2026-10-23T13:00:00.000Z').length,0)
})
test('roundtrip local storage restores intact job description',()=>{
  const storage=store()
  const pool=mergeLivePool([],[job('101','jobindex','full JD ' .repeat(100))],date)
  writeLivePool(storage,pool)
  assert.ok(storage.getItem(V20_LIVE_POOL_KEY))
  const recovered=readLivePool(storage,'2026-10-15T00:00:00.000Z')
  assert.deepEqual(recovered,pool)
})
test('preserves richer imported JD and existing numeric search score',()=>{
  const short=job('101','linkedin','short')
  const newer=rated('101')
  newer.job.fullJd='detailed '.repeat(100)
  const pool=mergeLivePool(mergeLivePool([],[short],date),[newer],'2026-10-15T13:00:00.000Z')
  assert.equal(pool[0].item.job.fullJd,newer.job.fullJd)
  assert.equal(pool[0].item.evaluation.score,8.2)
})
test('does not resurrect expired record on empty new search',()=>{
  const old=mergeLivePool([],[job('101')],date)
  const now='2026-10-25T13:00:00.000Z'
  assert.equal(mergeLivePool(old,[],now).length,0)
})

test('missing publication date cannot be retained as a ten-day Live Match',()=>{
 const undated=job('undated')
 delete undated.job.publishedAt
 assert.equal(mergeLivePool([],[undated],date).length,0)
})
test('newly discovered old vacancy is not refreshed by firstSeenAt',()=>{
 const outdated=job('outdated');outdated.job.publishedAt='2026-10-03T13:00:00.000Z'
 assert.equal(mergeLivePool([],[outdated],date).length,0)
})
