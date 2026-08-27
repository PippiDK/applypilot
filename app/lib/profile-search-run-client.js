const ACTIVE_SEARCH_RUN_KEY='applypilot-active-profile-search-run-v1'

async function requestJson(fetchImpl,url,body){
  const response=await fetchImpl(url,{method:body==null?'GET':'POST',headers:body==null?undefined:{'Content-Type':'application/json'},body:body==null?undefined:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok) throw new Error(data?.error||'Search Run request failed')
  return data
}

function saveActiveSearchRun(storage,snapshot){
  if(!storage?.setItem) return
  storage.setItem(ACTIVE_SEARCH_RUN_KEY,JSON.stringify(snapshot))
}

export function readActiveSearchRun(storage){
  try{
    const raw=storage?.getItem?.(ACTIVE_SEARCH_RUN_KEY)
    return raw?JSON.parse(raw):null
  }catch{return null}
}

export function clearActiveSearchRun(storage){
  try{storage?.removeItem?.(ACTIVE_SEARCH_RUN_KEY)}catch{}
}

function previewResult(run,candidates=[]){
  const rows=Array.isArray(candidates)?candidates:[]
  const jobs=rows.filter(row=>row.detailStatus==='PROCESSED'&&row.job&&row.evaluation&&row.audit?.decision==='KEEP').map(row=>({job:row.job,evaluation:row.evaluation})).sort((a,b)=>Number(b.evaluation?.score||0)-Number(a.evaluation?.score||0))
  const audit=rows.filter(row=>row.audit).map(row=>({jobId:String(row.jobId),title:row.job?.title||row.title||'',company:row.job?.company||row.company||'',...row.audit}))
  const fullJdProcessed=rows.filter(row=>row.detailStatus==='PROCESSED'||row.detailStatus==='UNVERIFIED').length
  return {jobs,audit,coverage:run.coverage||{status:run.status==='ACCESS_LIMITED'?'ACCESS LIMITED':'SEARCHED'},stats:{...(run.stats||{}),discovered:rows.length,fullJdProcessed,evaluated:jobs.length,returned:jobs.length},fetchedAt:run.updated_at||new Date().toISOString(),runId:run.id}
}

async function continueSearchRun({snapshot,fetchImpl,storage,onProgress}){
  saveActiveSearchRun(storage,snapshot)

  while(snapshot.run?.status==='DISCOVERING'){
    const body=snapshot.mode==='preview'?{run:snapshot.run,candidates:snapshot.candidates}:{runId:snapshot.run.id}
    const next=await requestJson(fetchImpl,'/api/linkedin-profile-search/discover',body)
    snapshot={mode:next.mode||snapshot.mode,run:next.run,candidates:next.mode==='preview'?(Array.isArray(next.candidates)?next.candidates:snapshot.candidates):snapshot.candidates}
    saveActiveSearchRun(storage,snapshot)
    onProgress({phase:'discovery',...(next.progress||{}),status:snapshot.run.status})
  }

  while(snapshot.run?.status==='READING_JDS'){
    const body=snapshot.mode==='preview'?{run:snapshot.run,candidates:snapshot.candidates}:{runId:snapshot.run.id}
    const next=await requestJson(fetchImpl,'/api/linkedin-profile-search/process',body)
    snapshot={mode:next.mode||snapshot.mode,run:next.run,candidates:next.mode==='preview'?(Array.isArray(next.candidates)?next.candidates:snapshot.candidates):snapshot.candidates}
    saveActiveSearchRun(storage,snapshot)
    onProgress({phase:'details',...(next.progress||{}),status:snapshot.run.status})
    if(next.complete){
      const result=next.result||(snapshot.mode==='preview'?previewResult(snapshot.run,snapshot.candidates):null)
      if(result){clearActiveSearchRun(storage);return result}
    }
  }

  if(snapshot.mode==='preview'&&['COMPLETE','ACCESS_LIMITED'].includes(snapshot.run?.status)){
    const result=previewResult(snapshot.run,snapshot.candidates)
    clearActiveSearchRun(storage)
    return result
  }

  if(snapshot.mode==='persistent'&&['COMPLETE','ACCESS_LIMITED'].includes(snapshot.run?.status)){
    const loaded=await requestJson(fetchImpl,`/api/linkedin-profile-search/run?id=${encodeURIComponent(snapshot.run.id)}`,null)
    clearActiveSearchRun(storage)
    return loaded.result
  }

  throw new Error(`Search Run stopped in unexpected status ${snapshot.run?.status||'UNKNOWN'}`)
}

export async function runProfileSearchRun({freshnessDays=7,unionSearchPlan={},exclusionRules=[],fetchImpl=globalThis.fetch,storage=globalThis.sessionStorage,onProgress=()=>{},resume=false}={}){
  if(typeof fetchImpl!=='function') throw new Error('Search Run fetch implementation is required.')
  let snapshot=resume?readActiveSearchRun(storage):null

  if(!snapshot){
    const created=await requestJson(fetchImpl,'/api/linkedin-profile-search/run',{freshnessDays,unionSearchPlan,exclusionRules})
    snapshot={mode:created.mode,run:created.run,candidates:Array.isArray(created.candidates)?created.candidates:[]}
  }

  return continueSearchRun({snapshot,fetchImpl,storage,onProgress})
}

export async function resumeActiveProfileSearchRun({fetchImpl=globalThis.fetch,storage=globalThis.sessionStorage,onProgress=()=>{}}={}){
  if(typeof fetchImpl!=='function') throw new Error('Search Run fetch implementation is required.')
  let snapshot=readActiveSearchRun(storage)
  if(!snapshot){
    const active=await requestJson(fetchImpl,'/api/linkedin-profile-search/run?active=1',null)
    if(!active?.active) return null
    snapshot={mode:active.mode||'persistent',run:active.run,candidates:Array.isArray(active.candidates)?active.candidates:[]}
  }
  return continueSearchRun({snapshot,fetchImpl,storage,onProgress})
}
