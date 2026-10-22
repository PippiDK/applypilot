import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {mergeLivePool,livePoolItems,V20_LIVE_POOL_KEY} from './v20-live-pool.js'
import {V20_POOL_DB,readV20PoolDb,writeV20PoolDb} from './v20-live-pool-indexeddb.js'

const main=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const dbSource=readFileSync(new URL('./v20-live-pool-indexeddb.js',import.meta.url),'utf8')
const now='2026-10-22T12:00:00.000Z'
const item=id=>({job:{source:'linkedin',sourceJobId:id,title:'Project Manager',company:'Example',publishedAt:'2026-10-21T12:00:00.000Z',description:'Verified JD'},evaluation:{score:8.2}})

test('v20 hydration never imports v19 archive on reload',()=>{
  const hydration=main.match(/const ready=\(async\(\)=>\{[\s\S]*?livePoolReadyRef\.current=ready/)
  assert.ok(hydration,'Must find v20 restore code')
  assert.match(hydration[0],/const saved=await readV20PoolDb\(\)/)
  assert.match(hydration[0],/const oldPool=readLivePool\(localStorage\)/)
  assert.match(hydration[0],/const merged=mergeLivePool\(saved,\[\.\.\.oldPool\.map\(row=>row\.item\),\.\.\.imported\]\)/)
  assert.doesNotMatch(hydration[0],/readLegacyV19Matches|legacyV19|readIndexedLiveMatches|applypilot-saved-live-matches-v1/)
  assert.doesNotMatch(main,/readLegacyV19Matches|legacyV19/)
})

test('v20 IndexedDB implementation accesses only v20 database',()=>{
  assert.equal(V20_POOL_DB,'auvraen-v20-live-pool-db-v1')
  assert.doesNotMatch(dbSource,/readLegacyV19Matches|applypilot-saved-live-matches-v1|objectStore\('matches'\)/)
})

function fakeIndexedDB(){
  const names=[]
  const records=new Map()
  const impl={open(name){
    names.push(name)
    if(name!==V20_POOL_DB)throw new Error('Cross-version IndexedDB access blocked: '+name)
    const request={}
    queueMicrotask(()=>{
      request.result={
        objectStoreNames:{contains:x=>x==='snapshot'},
        close(){},
        transaction(){
          const transaction={oncomplete:null,onerror:null,onabort:null}
          transaction.objectStore=()=>({
            get(key){
              const r={}
              queueMicrotask(()=>{r.result=structuredClone(records.get(key));r.onsuccess?.()})
              return r
            },
            put(value,key){
              records.set(key,structuredClone(value))
              queueMicrotask(()=>transaction.oncomplete?.())
              return {}
            },
          })
          return transaction
        },
      }
      request.onsuccess?.()
    })
    return request
  }}
  return {impl,names}
}

test('v20 stored vacancies survive reload without opening v19 database',async()=>{
  const fake=fakeIndexedDB()
  const rows=mergeLivePool([], [item('v20-a'),item('v20-b')],now)
  await writeV20PoolDb(rows,{indexedDBImpl:fake.impl,now})
  const saved=await readV20PoolDb({indexedDBImpl:fake.impl,now})
  const restored=mergeLivePool(saved,[],now)
  assert.deepEqual(livePoolItems(restored).map(row=>row.job.sourceJobId),['v20-a','v20-b'])
  assert.deepEqual(fake.names,[V20_POOL_DB,V20_POOL_DB])
  assert.equal(V20_LIVE_POOL_KEY,'auvraen-v20-live-pool-v1')
})
