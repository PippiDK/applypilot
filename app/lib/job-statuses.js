export const JOB_STATUS_STORAGE_KEY='applypilot-job-statuses-v1'

export const JOB_STATUS_OPTIONS=[
  {value:'',label:'STATUS'},
  {value:'applied',label:'APPLIED'},
  {value:'considering',label:'CONSIDERING'},
  {value:'ignore',label:'IGNORE'}
]

const VALID=new Set(JOB_STATUS_OPTIONS.map(option=>option.value).filter(Boolean))

export function normalizeJobStatuses(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return {}
  const result={}
  for(const [jobId,status] of Object.entries(value)){
    const key=String(jobId??'').trim()
    if(key&&VALID.has(status)) result[key]=status
  }
  return result
}

export function readJobStatuses(storage){
  try{
    return normalizeJobStatuses(JSON.parse(storage?.getItem?.(JOB_STATUS_STORAGE_KEY)||'{}'))
  }catch{
    return {}
  }
}

export function writeJobStatus({storage,statuses={},jobId,status}={}){
  const key=String(jobId??'').trim()
  const next={...normalizeJobStatuses(statuses)}
  if(!key) return next
  if(VALID.has(status)) next[key]=status
  else delete next[key]
  storage?.setItem?.(JOB_STATUS_STORAGE_KEY,JSON.stringify(next))
  return next
}
