import {parseSearchHtml} from './linkedin-search.js'
import {collectDiscoveryPasses} from './linkedin-discovery-stabilizer.js'

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const WINDOWS=new Set([1,3,7,14])
const SEARCH_PAGE_SIZE=25
const MAX_SEARCH_PAGES=4
const MAX_DISCOVERY_PASSES=4
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
  const direction={
    key:text(raw?.key)||role.toLowerCase(),
    role,
    tier:raw?.tier==='primary'?'primary':'adjacent',
    origin:raw?.origin==='cv'?'cv':'manual',
    cvSlots:cleanSlots(raw?.cvSlots)
  }
  const query=text(raw?.query)
  if(query) direction.query=query
  if(raw?.discoveryMode) direction.discoveryMode=raw.discoveryMode==='expanded'?'expanded':'exact'
  return direction
}

function foundByKey(direction){
  return `${direction.key}|${text(direction.query)||direction.role}|${direction.discoveryMode||'exact'}|${direction.tier}|${direction.origin}|${direction.cvSlots.join(',')}`
}

function groupDirections(directions){
  const byQuery=new Map()
  for(const direction of directions){
    const query=text(direction.query)||direction.role
    const key=query.toLowerCase()
    if(!byQuery.has(key)) byQuery.set(key,{query,directions:[]})
    byQuery.get(key).directions.push(direction)
  }
  return [...byQuery.values()]
}

export async function searchLinkedInShadow({freshnessDays=7,unionSearchPlan={},fetcher}={}){
  const days=WINDOWS.has(Number(freshnessDays))?Number(freshnessDays):7
  const directions=(Array.isArray(unionSearchPlan?.directions)?unionSearchPlan.directions:[])
    .map(normalizeDirection)
    .filter(Boolean)

  const emptyStats={directions:0,primaryDirections:0,adjacentDirections:0,searchRequests:0,searchFailures:0,searchRows:0,discovered:0,discoveryPasses:0,discoveryStable:false}
  if(!directions.length) return {candidates:[],stats:emptyStats,coverage:{status:'NO DIRECTIONS',detail:null}}
  if(typeof fetcher!=='function') throw new Error('Shadow LinkedIn fetcher is required.')

  const searchGroups=groupDirections(directions)
  const groupByQuery=new Map(searchGroups.map(group=>[group.query.toLowerCase(),group]))
  const starts=Array.from({length:MAX_SEARCH_PAGES},(_,page)=>page*SEARCH_PAGE_SIZE)
  const passes=Array.from({length:MAX_DISCOVERY_PASSES},(_,index)=>({
    group:`${days}d`,
    days,
    starts,
    label:`${days}d-pass-${index+1}`,
  }))

  const discovery=await collectDiscoveryPasses({
    queries:searchGroups.map(group=>group.query),
    passes,
    fetchPage:async({query,start,seconds})=>{
      const qs=new URLSearchParams({keywords:query,location:'Denmark',f_TPR:`r${seconds}`,sortBy:'DD',start:String(start)})
      const html=await fetcher(`${LINKEDIN_SEARCH}?${qs}`)
      return parseSearchHtml(html)
    },
  })

  if(discovery.searchRequests>0&&discovery.searchFailures===discovery.searchRequests){
    throw new Error(`LinkedIn shadow search unavailable: ${discovery.errors[0]||'all search requests failed'}`)
  }

  const byId=new Map()
  for(const row of discovery.rows){
    const jobId=text(row?.jobId)
    if(!jobId) continue
    const candidate={...row,jobId,foundBy:[],__foundByKeys:new Set()}
    byId.set(jobId,candidate)
  }

  // Reconstruct provenance deterministically from the queries in which each job
  // was observed. collectDiscoveryPasses returns the union; fetch-page rows keep
  // their query marker below so discovery path never affects later evaluation.
  const observedById=new Map()
  await collectDiscoveryPasses({
    queries:searchGroups.map(group=>group.query),
    passes:[{group:`${days}d-provenance`,days,starts,label:`${days}d-provenance`}],
    fetchPage:async({query,start,seconds})=>{
      const qs=new URLSearchParams({keywords:query,location:'Denmark',f_TPR:`r${seconds}`,sortBy:'DD',start:String(start)})
      const html=await fetcher(`${LINKEDIN_SEARCH}?${qs}`)
      const rows=parseSearchHtml(html)
      for(const row of rows){
        const id=text(row?.jobId)
        if(!id) continue
        if(!observedById.has(id)) observedById.set(id,new Set())
        observedById.get(id).add(query.toLowerCase())
      }
      return rows
    },
  })

  for(const [jobId,candidate] of byId){
    const observed=observedById.get(jobId)||new Set()
    for(const queryKey of observed){
      const group=groupByQuery.get(queryKey)
      if(!group) continue
      for(const direction of group.directions){
        const key=foundByKey(direction)
        if(candidate.__foundByKeys.has(key)) continue
        candidate.__foundByKeys.add(key)
        candidate.foundBy.push(direction)
      }
    }
  }

  const candidates=[...byId.values()].map(({__foundByKeys,...candidate})=>candidate)
  const groupStats=discovery.groups[`${days}d`]||{}
  const coverage=discovery.searchFailures?'ACCESS LIMITED':candidates.length?'SEARCHED':'NO RELEVANT RESULTS'
  return {
    candidates,
    stats:{
      directions:directions.length,
      primaryDirections:directions.filter(d=>d.tier==='primary').length,
      adjacentDirections:directions.filter(d=>d.tier==='adjacent').length,
      searchRequests:discovery.searchRequests,
      searchFailures:discovery.searchFailures,
      searchRows:discovery.searchRows,
      discovered:candidates.length,
      discoveryPasses:Number(groupStats.passesExecuted||0),
      discoveryStable:Boolean(groupStats.stable),
    },
    coverage:{status:coverage,detail:discovery.errors[0]||null}
  }
}
