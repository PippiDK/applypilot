// Browser-only retention of evaluated Live Matches; independent of discovery, Master Pool and Night Flight.
export const LIVE_MATCHES_STORAGE_KEY='applypilot-live-matches-v19-v1'
const TEN_DAYS_MS=10*86400000
const parseTime=value=>{const n=Date.parse(String(value||''));return Number.isFinite(n)?n:null}
const text=value=>String(value??'').trim()
export function liveMatchIdentity(item){
  const job=item?.job
  if(!job||!text(job.title)||!text(job.company))return ''
  const rawSource=text(job.source||job.sourceRecords?.[0]?.source).toLowerCase()
  const source=rawSource.includes('linkedin')?'linkedin':rawSource
  const id=text(job.sourceJobId||job.jobId).replace(/^linkedin:/,'')
  if(source&&id)return source+':'+id
  return source+':'+text(job.company).toLowerCase()+'|'+text(job.title).toLowerCase()+'|'+text(job.location).toLowerCase()
}
function eligible(item,now){
  if(!Number.isFinite(item?.evaluation?.score)||item?.evaluation?.hardExclusion===true)return false
  const published=parseTime(item?.job?.publishedAt)
  return published!==null&&published<=now&&now-published<TEN_DAYS_MS
}
export function mergeSavedLiveMatches(existing=[],incoming=[],now=new Date().toISOString()){
  const clock=parseTime(now)
  if(clock===null)throw new Error('Invalid Live Matches clock')
  const byId=new Map()
  for(const row of Array.isArray(existing)?existing:[]){
    const key=liveMatchIdentity(row?.item)
    if(key&&eligible(row.item,clock)&&!byId.has(key))byId.set(key,{item:row.item,firstSeenAt:row.firstSeenAt})
  }
  for(const item of Array.isArray(incoming)?incoming:[]){
    const key=liveMatchIdentity(item)
    if(!key||!eligible(item,clock))continue
    const previous=byId.get(key)
    byId.set(key,{item,firstSeenAt:previous?.firstSeenAt||now})
  }
  return [...byId.values()]
}
export function readSavedLiveMatches(storage,now=new Date().toISOString()){
  let rows=[]
  try{rows=JSON.parse(storage?.getItem?.(LIVE_MATCHES_STORAGE_KEY)||'[]')}catch{}
  return mergeSavedLiveMatches(rows,[],now)
}
export function writeSavedLiveMatches(storage,pool){
  storage.setItem(LIVE_MATCHES_STORAGE_KEY,JSON.stringify(pool))
  return pool
}
export function savedLiveMatchItems(rows=[]){return rows.map(row=>row.item)}
