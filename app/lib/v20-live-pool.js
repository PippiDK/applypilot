// Apply Pilot v20: independent 10-day Live Matches retention. No discovery or Night Pilot logic.
export const V20_LIVE_POOL_KEY='auvraen-v20-live-pool-v1'
export const V20_LIVE_POOL_DAYS=10
const TTL=V20_LIVE_POOL_DAYS*24*60*60*1000

const asTime=value=>{const n=Date.parse(String(value||''));return Number.isFinite(n)?n:null}
const text=value=>String(value??'').trim()
function identity(item){
  const job=item?.job
  if(!job||!text(job.title)||!text(job.company))return ''
  const rawSource=text(job.source||job.sourceRecords?.[0]?.source).toLowerCase()
  const source=rawSource.includes('linkedin')?'linkedin':rawSource
  const id=text(job.sourceJobId||job.jobId)
  if(source&&id)return source+':'+id.replace(/^linkedin:/,'')
  // Do not merge vacancies with different locations unless the provider has a stable ID.
  return source+':'+text(job.company).toLowerCase()+'|'+text(job.title).toLowerCase()+'|'+text(job.location).toLowerCase()
}
function prefer(prev,next){
  const old=prev.item,newItem=next.item
  const oldJd=text(old?.job?.fullJd||old?.job?.description)
  const newJd=text(newItem?.job?.fullJd||newItem?.job?.description)
  const oldRated=Number.isFinite(old?.evaluation?.score)
  const newRated=Number.isFinite(newItem?.evaluation?.score)
  const goodJd=item=>item?.job?.needsJdReview!==true&&text(item?.job?.fullJd||item?.job?.description).length>=100
  const useNew=goodJd(newItem)&&!goodJd(old)||goodJd(newItem)===goodJd(old)&&newJd.length>oldJd.length
  // Prefer a more complete JD; otherwise refresh normal Search evaluations.
  const job=useNew?newItem.job:old.job
  const evaluation=newRated?newItem.evaluation:oldRated?old.evaluation:newItem.evaluation||old.evaluation
  return {item:{job,evaluation},firstSeenAt:prev.firstSeenAt}
}
export function mergeLivePool(existing=[],incoming=[],now=new Date().toISOString()){
  const nowMs=asTime(now)
  if(nowMs===null)throw new Error('Invalid pool clock')
  const map=new Map()
  for(const row of Array.isArray(existing)?existing:[]){
    const key=identity(row?.item)
    const first=asTime(row?.firstSeenAt)
    if(!key||first===null||first>nowMs||nowMs-first>=TTL)continue
    if(!map.has(key))map.set(key,{item:row.item,firstSeenAt:row.firstSeenAt})
  }
  for(const item of Array.isArray(incoming)?incoming:[]){
    const key=identity(item)
    if(!key)continue
    const fresh={item,firstSeenAt:now}
    map.set(key,map.has(key)?prefer(map.get(key),fresh):fresh)
  }
  return [...map.values()]
}
export function readLivePool(storage,now=new Date().toISOString()){
  let raw=[]
  try{raw=JSON.parse(storage?.getItem?.(V20_LIVE_POOL_KEY)||'[]')}catch{}
  return mergeLivePool(raw,[],now)
}
export function writeLivePool(storage,pool){
  // Do not silently claim persistence when the browser's quota is exceeded.
  storage.setItem(V20_LIVE_POOL_KEY,JSON.stringify(pool))
  return pool
}
export function livePoolItems(pool=[]){return pool.map(row=>row.item)}
