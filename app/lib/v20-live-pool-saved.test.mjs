import test from 'node:test'
import assert from 'node:assert/strict'
import {mergeLivePool,livePoolItems,livePoolIdentity,readLivePool,writeLivePool,V20_LIVE_POOL_KEY} from './v20-live-pool.js'

const today='2026-10-19T12:00:00.000Z'
const job=(id,date='2026-10-18T10:00:00.000Z',extra={})=>({job:{source:'linkedin',sourceJobId:id,title:'Project Manager',company:'Example',location:'Copenhagen',publishedAt:date,...extra},evaluation:{score:0.9}})
test('retains previously evaluated search results and adds new jobs without duplicates',()=>{
  const a=mergeLivePool([], [job('1')],today)
  const b=mergeLivePool(a,[job('2'),job('1')],today)
  assert.equal(b.length,2)
  assert.deepEqual(new Set(livePoolItems(b).map(x=>x.job.sourceJobId)),new Set(['1','2']))
})
test('retention uses publishedAt rather than firstSeenAt',()=>{
  assert.equal(mergeLivePool([],[job('old','2026-10-08T11:00:00.000Z')],today).length,0)
  const recent=mergeLivePool([],[job('recent','2026-10-14T11:00:00.000Z')],today)
  assert.equal(mergeLivePool(recent,[],'2026-10-25T12:00:00.000Z').length,0)
})
test('old imported jobs with no reliable date keep legacy ten-day first-seen behavior',()=>{
  const input=job('3',undefined,{importSource:'linkedin-json',publishedAt:null})
  input.evaluation={score:null}
  const a=mergeLivePool([],[input],today)
  assert.equal(a.length,1)
  assert.equal(mergeLivePool(a,[],'2026-10-30T12:00:00.000Z').length,0)
})
test('browser persistence restores rows',()=>{
 const store=new Map()
 const storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)}
 writeLivePool(storage,mergeLivePool([],[job('4')],today))
 assert.equal(JSON.parse(store.get(V20_LIVE_POOL_KEY)).length,1)
 assert.equal(readLivePool(storage,today).length,1)
 assert.equal(livePoolIdentity(job('4')),livePoolIdentity(job('4')))
})
