const ALLOWED_PATCH_KEYS=new Set(['title','company','stage','decision','reason','score'])

function text(value=''){return String(value??'').trim()}

export function createAuditRecord(row={}){
  return {
    jobId:text(row.jobId||row.sourceJobId),
    title:text(row.title),
    company:text(row.company),
    stage:'DISCOVERED',
    decision:'PENDING',
    reason:null,
    score:null,
  }
}

export function updateAuditRecord(map,jobId,patch={}){
  const key=text(jobId)
  const current=map.get(key)
  if(!current) return null
  const safe={...current}
  for(const [name,value] of Object.entries(patch)) if(ALLOWED_PATCH_KEYS.has(name)) safe[name]=value
  map.set(key,safe)
  return safe
}

export function auditList(map){
  return [...map.values()].map(record=>({...record}))
}
