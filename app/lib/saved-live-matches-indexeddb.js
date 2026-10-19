// Browser-only IndexedDB storage for evaluated Live Matches. Search and Applied History are separate.
import {liveMatchIdentity,mergeSavedLiveMatches} from './saved-live-matches.js'

export const LIVE_MATCHES_DB_NAME='applypilot-saved-live-matches-v1'
const STORE='matches'

function openDatabase(indexedDBImpl=globalThis.indexedDB){
  return new Promise((resolve,reject)=>{
    if(!indexedDBImpl){reject(new Error('IndexedDB is unavailable'));return}
    const request=indexedDBImpl.open(LIVE_MATCHES_DB_NAME,1)
    request.onupgradeneeded=()=>{
      const db=request.result
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'})
    }
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'))
    request.onblocked=()=>reject(new Error('IndexedDB upgrade blocked'))
  })
}

export async function readIndexedLiveMatches({indexedDBImpl,now=new Date().toISOString()}={}){
  const db=await openDatabase(indexedDBImpl)
  try{
    const rows=await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readonly')
      const request=transaction.objectStore(STORE).getAll()
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error||new Error('IndexedDB read failed'))
      transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB transaction failed'))
    })
    return mergeSavedLiveMatches(rows,[],now)
  }finally{db.close()}
}

export async function writeIndexedLiveMatches(rows,{indexedDBImpl,now=new Date().toISOString()}={}){
  const retained=mergeSavedLiveMatches(rows,[],now)
  const db=await openDatabase(indexedDBImpl)
  try{
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite')
      const store=transaction.objectStore(STORE)
      // One atomic transaction: if any put fails, the prior snapshot is preserved.
      store.clear()
      for(const row of retained){
        store.put({id:liveMatchIdentity(row.item),item:row.item,firstSeenAt:row.firstSeenAt})
      }
      transaction.oncomplete=()=>resolve()
      transaction.onerror=()=>reject(transaction.error||new Error('IndexedDB write failed'))
      transaction.onabort=()=>reject(transaction.error||new Error('IndexedDB write aborted'))
    })
    return retained
  }finally{db.close()}
}
