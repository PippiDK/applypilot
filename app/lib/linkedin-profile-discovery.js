import {parseSearchHtml} from './linkedin-search.js'
import {buildDiscoveryPasses} from './linkedin-discovery-plan.js'

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const WINDOWS=new Set([1,3,7,14])
const text=value=>String(value??'').replace(/\s+/g,' ').trim()

function cleanSlots(values=[]){
  const out=[]
  const seen=new Set()
  for(const raw of Array.isArray(values)?values:[]){
    const slot=Number(raw)
    if(!Number.isFinite(slot)||slot<=0||seen.has(slot)) continue
    seen.add(slot)
    out.push(slot)
  }
  return out
}

function normalizeDirection(raw={}){
  const role=text(raw?.role)
  if(!role) return null
  return {
    key:text(raw?.key)||role.toLowerCase(),
    role,
    tier:raw?.tier==='primary'?'primary':'adjacent',
    origin:raw?.origin==='cv'?'cv':'manual',
    cvSlots:cleanSlots(raw?.cvSlots),
  }
}

function foundByKey(direction){
  return `${direction.key}|${direction.tier}|${direction.origin}|${direction.cvSlots.join(',')}`
}

function addCandidate(byId,row,direction){
  const jobId=text(row?.jobId)
  if(!jobId) return false
  const isNew=!byId.has(jobId)
  if(isNew) byId.set(jobId,{...row,jobId,foundBy:[],__foundByKeys:new Set()})
  const candidate=byId.get(jobId)
  const key=foundByKey(direction)
  if(!candidate.__foundByKeys.has(key)){
    candidate.__foundByKeys.add(key)
    candidate.foundBy.push(direction)
  }
  return isNew
}

export async function searchLinkedInProfileDiscovery({freshnessDays=7,unionSearchPlan={},fetcher}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[])
    .map(normalizeDirection)
    .filter(Boolean)

  const emptyStats={directions:0,primaryDirections:0,adjacentDirections:0,searchRequests:0,searchFailures:0,searchRows:0,discovered:0,discoveryPasses:[],discoveryGroups:{}}
  if(!directions.length) return {candidates:[],stats:emptyStats,coverage:{status:'NO DIRECTIONS',detail:null}}
  if(typeof fetcher!=='function') throw new Error('Profile LinkedIn fetcher is required.')

  const passes=buildDiscoveryPasses(days)
  const byId=new Map()
  const stableGroups=new Set()
  const groups={}
  const passStats=[]
  const errors=[]
  let searchRequests=0
  let searchFailures=0
  let searchRows=0

  for(const pass of passes){
    const group=String(pass.group||pass.days||'default')
    if(stableGroups.has(group)) continue

    let newJobIds=0
    let passFailures=0
    let passRequests=0
    let passRows=0

    for(const direction of directions){
      for(const start of pass.starts||[0]){
        searchRequests++
        passRequests++
        try{
          const qs=new URLSearchParams({
            keywords:direction.role,
            location:'Denmark',
            f_TPR:`r${Number(pass.days)*86400}`,
            sortBy:'DD',
            start:String(start),
          })
          const html=await fetcher(`${LINKEDIN_SEARCH}?${qs}`)
          const rows=parseSearchHtml(html)
          searchRows+=rows.length
          passRows+=rows.length
          for(const row of rows) if(addCandidate(byId,row,direction)) newJobIds++
          if(rows.length===0) break
        }catch(error){
          searchFailures++
          passFailures++
          errors.push(String(error?.message||error))
        }
      }
    }

    const previous=groups[group]||{stable:false,passesExecuted:0,newJobIds:0}
    const current={
      stable:false,
      passesExecuted:previous.passesExecuted+1,
      newJobIds:previous.newJobIds+newJobIds,
    }
    if(current.passesExecuted>1&&newJobIds===0&&passFailures===0){
      current.stable=true
      stableGroups.add(group)
    }
    groups[group]=current
    passStats.push({
      label:pass.label||`${group}-pass-${current.passesExecuted}`,
      group,
      days:Number(pass.days),
      requests:passRequests,
      rows:passRows,
      failures:passFailures,
      newJobIds,
      totalUnique:byId.size,
    })
  }

  if(searchRequests>0&&searchFailures===searchRequests){
    throw new Error(`LinkedIn profile discovery unavailable: ${errors[0]||'all search requests failed'}`)
  }

  const candidates=[...byId.values()].map(({__foundByKeys,...candidate})=>candidate)
  const coverage=searchFailures?'ACCESS LIMITED':candidates.length?'SEARCHED':'NO RELEVANT RESULTS'
  return {
    candidates,
    stats:{
      directions:directions.length,
      primaryDirections:directions.filter(direction=>direction.tier==='primary').length,
      adjacentDirections:directions.filter(direction=>direction.tier==='adjacent').length,
      searchRequests,
      searchFailures,
      searchRows,
      discovered:candidates.length,
      discoveryPasses:passStats,
      discoveryGroups:groups,
    },
    coverage:{status:coverage,detail:errors[0]||null},
  }
}
