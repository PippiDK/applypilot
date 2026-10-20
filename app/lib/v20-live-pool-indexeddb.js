// v20-only IndexedDB persistence for its independent ten-day, manual-import-capable pool.
// Never shares the v19 database, tables or eligibility rules.
import {mergeLivePool} from './v20-live-pool.js'
export const V20_POOL_DB='auvraen-v20-live-pool-db-v1'
const STORE='snapshot'
function openDb(impl=globalThis.indexedDB){
 return new Promise((resolve,reject)=>{
  if(!impl)return reject(new Error('IndexedDB unavailable'))
  const request=impl.open(V20_POOL_DB,1)
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)}
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(request.error||new Error('v20 IndexedDB open failed'))
  request.onblocked=()=>reject(new Error('v20 IndexedDB upgrade blocked'))
 })
}
export async function readV20PoolDb({indexedDBImpl,now=new Date().toISOString()}={}){
 const db=await openDb(indexedDBImpl)
 try{
  const rows=await new Promise((resolve,reject)=>{
   const transaction=db.transaction(STORE,'readonly')
   const req=transaction.objectStore(STORE).get('retained')
   req.onsuccess=()=>resolve(req.result||[])
   req.onerror=()=>reject(req.error||new Error('v20 IndexedDB read failed'))
   transaction.onerror=()=>reject(transaction.error||new Error('v20 IndexedDB read transaction failed'))
  })
  return mergeLivePool(rows,[],now)
 }finally{db.close()}
}
export async function writeV20PoolDb(rows,{indexedDBImpl,now=new Date().toISOString()}={}){
 const retained=mergeLivePool(rows,[],now)
 const db=await openDb(indexedDBImpl)
 try{
  await new Promise((resolve,reject)=>{
   const transaction=db.transaction(STORE,'readwrite')
   transaction.objectStore(STORE).put(retained,'retained')
   transaction.oncomplete=()=>resolve()
   transaction.onerror=()=>reject(transaction.error||new Error('v20 IndexedDB write failed'))
   transaction.onabort=()=>reject(transaction.error||new Error('v20 IndexedDB write aborted'))
  })
  return retained
 }finally{db.close()}
}
