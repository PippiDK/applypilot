import test from 'node:test'
import assert from 'node:assert/strict'
import {readV20PoolDb,writeV20PoolDb,V20_POOL_DB} from './v20-live-pool-indexeddb.js'
import {mergeLivePool} from './v20-live-pool.js'
function memoryIdb(){
 const records=new Map()
 return {records,open(name){
  assert.equal(name,V20_POOL_DB)
  const request={}
  queueMicrotask(()=>{
   request.result={objectStoreNames:{contains:n=>n==='snapshot'},close(){},transaction(_store,mode){
    const tx={oncomplete:null,onerror:null,onabort:null}
    tx.objectStore=()=>({
     get(key){
      const r={};queueMicrotask(()=>{r.result=structuredClone(records.get(key));r.onsuccess?.()});return r
     },
     put(value,key){records.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());return {}}
    })
    return tx
   }}
   request.onsuccess?.()
  })
  return request
 }}
}
const now='2026-10-20T12:00:00.000Z'
const item=(id,description)=>({job:{source:'linkedin',sourceJobId:id,title:'Project Manager',company:'Example',description,fullJd:description,publishedAt:null,importSource:'linkedin-json'},evaluation:{score:null}})
test('v20 isolated IndexedDB retains manual JSON with undated incomplete/full JD',async()=>{
 const db=memoryIdb()
 const original=mergeLivePool([],[item('one','Full text'),item('two','Incomplete JD')],now)
 await writeV20PoolDb(original,{indexedDBImpl:db,now})
 const back=await readV20PoolDb({indexedDBImpl:db,now})
 assert.deepEqual(back,original)
 assert.equal(back[0].item.job.importSource,'linkedin-json')
 assert.equal(db.records.size,1)
})
test('v20 IndexedDB retention follows original firstSeen TTL',async()=>{
 const db=memoryIdb()
 const original=mergeLivePool([],[item('old','Old JD')],now)
 await writeV20PoolDb(original,{indexedDBImpl:db,now})
 assert.equal((await readV20PoolDb({indexedDBImpl:db,now:'2026-10-29T12:00:00.000Z'})).length,1)
 assert.equal((await readV20PoolDb({indexedDBImpl:db,now:'2026-10-30T12:00:00.000Z'})).length,0)
})
