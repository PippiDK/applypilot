import {parseSearchHtml} from './linkedin-search.js'

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const WINDOWS=new Set([1,3,7,14])
const text=value=>String(value??'').replace(/\s+/g,' ').trim()

function normalizeDirection(raw={},index=0){
  const role=text(raw?.role)
  if(!role) return null
  return {
    index,
    key:text(raw?.key)||role.toLowerCase(),
    role,
    tier:raw?.tier==='primary'?'primary':'adjacent',
    origin:raw?.origin==='cv'?'cv':'manual',
    cvSlots:Array.isArray(raw?.cvSlots)?raw.cvSlots.map(Number).filter(Number.isFinite):[],
  }
}

function directionKey(direction){
  return `${direction.key}|${direction.tier}|${direction.origin}|${direction.cvSlots.join(',')}`
}

function normalizeKnown(values=[]){
  const byId=new Map()
  for(const raw of Array.isArray(values)?values:[]){
    const jobId=text(raw?.jobId)
    if(!jobId) continue
    byId.set(jobId,{...raw,jobId,foundBy:Array.isArray(raw?.foundBy)?[...raw.foundBy]:[]})
  }
  return byId
}

function mergeCandidate(byId,row,direction){
  const jobId=text(row?.jobId)
  if(!jobId) return false
  const isNew=!byId.has(jobId)
  if(isNew) byId.set(jobId,{...row,jobId,foundBy:[]})
  const candidate=byId.get(jobId)
  const key=directionKey(direction)
  if(!candidate.foundBy.some(existing=>directionKey(existing)===key)) candidate.foundBy.push(direction)
  return isNew
}

export function createDiscoveryState(unionSearchPlan={}){
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[])
    .map(normalizeDirection)
    .filter(Boolean)
    .map(direction=>({
      ...direction,
      nextStart:0,
      lastFingerprint:'',
      noNewStreak:0,
      complete:false,
      terminalReason:'',
      accessLimited:false,
      pagesRead:0,
    }))
  return {version:'profile-discovery-run-v1',directions,complete:directions.length===0,accessLimited:false,requests:0,pagesRead:0}
}

function hydrateState(state,unionSearchPlan){
  if(state?.version==='profile-discovery-run-v1'&&Array.isArray(state.directions)) return JSON.parse(JSON.stringify(state))
  return createDiscoveryState(unionSearchPlan)
}

function fingerprint(rows=[]){
  return rows.map(row=>text(row?.jobId)).filter(Boolean).join('|')
}

function finishDirection(direction,reason,{accessLimited=false}={}){
  direction.complete=true
  direction.terminalReason=reason
  if(accessLimited) direction.accessLimited=true
}

function nextDirection(state){
  return state.directions.find(direction=>!direction.complete)||null
}

export async function runDiscoveryBatch({freshnessDays=7,unionSearchPlan={},state,knownCandidates=[],fetcher,maxRequests=8}={}){
  if(typeof fetcher!=='function') throw new Error('Profile discovery batch fetcher is required.')
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  const working=hydrateState(state,unionSearchPlan)
  const byId=normalizeKnown(knownCandidates)
  const limit=Math.max(1,Math.floor(Number(maxRequests)||8))
  const errors=[]
  let requests=0
  let rowsRead=0
  let newJobIds=0

  while(requests<limit){
    const direction=nextDirection(working)
    if(!direction) break

    const qs=new URLSearchParams({
      keywords:direction.role,
      location:'Denmark',
      f_TPR:`r${days*86400}`,
      sortBy:'DD',
      start:String(direction.nextStart||0),
    })

    requests++
    working.requests=(working.requests||0)+1
    try{
      const html=await fetcher(`${LINKEDIN_SEARCH}?${qs}`)
      const rows=parseSearchHtml(html)
      direction.pagesRead=(direction.pagesRead||0)+1
      working.pagesRead=(working.pagesRead||0)+1
      rowsRead+=rows.length

      if(rows.length===0){
        finishDirection(direction,'EMPTY_PAGE')
        continue
      }

      const currentFingerprint=fingerprint(rows)
      if(currentFingerprint&&currentFingerprint===direction.lastFingerprint){
        finishDirection(direction,'REPEATED_PAGE')
        continue
      }

      let pageNew=0
      for(const row of rows){
        if(mergeCandidate(byId,row,direction)){
          pageNew++
          newJobIds++
        }
      }

      direction.lastFingerprint=currentFingerprint
      direction.noNewStreak=pageNew===0?(Number(direction.noNewStreak)||0)+1:0
      if(direction.noNewStreak>=2){
        finishDirection(direction,'TWO_NO_NEW_PAGES')
        continue
      }

      direction.nextStart=(Number(direction.nextStart)||0)+25
    }catch(error){
      const message=String(error?.message||error||'LinkedIn discovery request failed')
      errors.push(message)
      finishDirection(direction,'ACCESS_FAILURE',{accessLimited:true})
    }
  }

  working.complete=working.directions.every(direction=>direction.complete)
  working.accessLimited=working.directions.some(direction=>direction.accessLimited)

  return {
    state:working,
    candidates:[...byId.values()],
    complete:working.complete,
    accessLimited:working.accessLimited,
    stats:{requests,rowsRead,newJobIds,totalUnique:byId.size},
    coverage:{status:working.accessLimited?'ACCESS LIMITED':working.complete?'SEARCHED':'SEARCHING',detail:errors[0]||null},
  }
}
