import test from 'node:test'
import assert from 'node:assert/strict'
import {v20VisibleByWindow,v20SortedByScore,v20ScoreLabel} from './v20-match-view.js'
import {mergeLivePool,livePoolItems} from './v20-live-pool.js'
const now=new Date('2026-10-20T10:00:00Z')
const row=(id,at,score,importSource)=>({job:{source:'linkedin',sourceJobId:id,title:'Project '+id,company:'Example',publishedAt:at,importSource},evaluation:{score}})
test('v20 one day displays today, while unknown-date JSON remains outside the dated archive',()=>{
 const old=row('old','2026-10-16T08:00:00Z',9.6)
 const today=row('today','2026-10-20T08:00:00Z',8.4)
 const importUndated=row('manual',null,null,'linkedin-json')
 const pool=mergeLivePool([], [old,today,importUndated],now.toISOString())
 assert.equal(pool.length,2)
 assert.deepEqual(v20VisibleByWindow(livePoolItems(pool),1,now).map(x=>x.job.sourceJobId),['today'])
 assert.equal(v20VisibleByWindow(livePoolItems(pool),5,now).length,2)
 assert.equal(pool.length,2)
})
test('v20 sorted matching scores and N/A import remain in results',()=>{
 const a=row('one','2026-10-20T08:00:00Z',8.4)
 const b=row('two','2026-10-19T08:00:00Z',9.6)
 const c=row('manual',null,null,'linkedin-json')
 assert.deepEqual(v20SortedByScore([a,c,b]).map(x=>x.job.sourceJobId),['two','one','manual'])
 assert.equal(v20ScoreLabel(b.evaluation),'9.6/10')
 assert.equal(v20ScoreLabel(c.evaluation),'N/A')
})
