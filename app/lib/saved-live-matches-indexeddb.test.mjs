import test from 'node:test'
import assert from 'node:assert/strict'
import {readIndexedLiveMatches,writeIndexedLiveMatches} from './saved-live-matches-indexeddb.js'
import {mergeSavedLiveMatches} from './saved-live-matches.js'

const start='2026-10-19T12:00:00.000Z'
const item=(id,publishedAt='2026-10-18T12:00:00.000Z')=>({
  job:{source:'linkedin',sourceJobId:id,title:'Project Manager',company:'Example',location:'Denmark',publishedAt,fullJd:'Full JD preserved'},
  evaluation:{score:0.88,breakdown:{tier:'High'}}
})

// Minimal asynchronous IndexedDB contract fake: exercises real adapter requests and transaction lifecycle,
// but does not prove Microsoft Edge persistence, quota enforcement or upgrade behaviour.
function memoryIndexedDB(){
  const rows=new Map()
  const stores={contains:name=>name==='matches'}
  return {
    open:()=>{
      const request={result:null,error:null}
      queueMicrotask(()=>{
        const db={
          objectStoreNames:stores,
          createObjectStore:()=>{},
          close:()=>{},
          transaction:(_name,mode)=>{
            const tx={oncomplete:null,onerror:null,onabort:null,error:null}
            let pending=0,done=false
            const complete=()=>{
              if(done||pending)return
              done=true
              queueMicrotask(()=>tx.oncomplete?.())
            }
            const store={
              getAll:()=>{
                const r={onsuccess:null,onerror:null,result:null}
                pending++
                queueMicrotask(()=>{
                  r.result=[...rows.values()]
                  r.onsuccess?.()
                  pending--
                  complete()
                })
                return r
              },
              clear:()=>{rows.clear();return {}},
              put:row=>{rows.set(row.id,structuredClone(row));return {}},
            }
            tx.objectStore=()=>store
            if(mode==='readwrite')queueMicrotask(complete)
            return tx
          },
        }
        request.result=db
        request.onsuccess?.()
      })
      return request
    },
    rows,
  }
}

test('IndexedDB saves full JD, reopens and deduplicates by source identity',async()=>{
  const indexedDBImpl=memoryIndexedDB()
  const first=mergeSavedLiveMatches([],[item('101'),item('202')],start)
  await writeIndexedLiveMatches(first,{indexedDBImpl,now:start})
  assert.equal(indexedDBImpl.rows.size,2)
  const restored=await readIndexedLiveMatches({indexedDBImpl,now:start})
  assert.equal(restored.length,2)
  assert.equal(restored[0].item.job.fullJd,'Full JD preserved')
  await writeIndexedLiveMatches(mergeSavedLiveMatches(restored,[item('101')],start),{indexedDBImpl,now:start})
  assert.equal(indexedDBImpl.rows.size,2)
})

test('expired matches are physically removed when a later snapshot is written',async()=>{
  const indexedDBImpl=memoryIndexedDB()
  const initial=mergeSavedLiveMatches([],[item('old','2026-10-10T12:00:01.000Z'),item('fresh')],start)
  await writeIndexedLiveMatches(initial,{indexedDBImpl,now:start})
  assert.equal(indexedDBImpl.rows.size,2)
  const later='2026-10-21T12:00:00.000Z'
  const retained=await readIndexedLiveMatches({indexedDBImpl,now:later})
  assert.equal(retained.length,1)
  await writeIndexedLiveMatches(retained,{indexedDBImpl,now:later})
  assert.equal(indexedDBImpl.rows.size,1)
})
