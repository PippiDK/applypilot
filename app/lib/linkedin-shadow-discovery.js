import {parseSearchHtml} from './linkedin-search.js'

const LINKEDIN_SEARCH='https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
const WINDOWS=new Set([1,3,5,7,10,14])
const SEARCH_PAGE_SIZE=25
const MAX_SEARCH_PAGES=4
const MAX_SEARCH_REQUESTS=64
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

async function mapLimit(items,limit,fn){
  const results=new Array(items.length)
  let next=0
  async function worker(){
    while(true){
      const index=next++
      if(index>=items.length) return
      try{results[index]={status:'fulfilled',value:await fn(items[index],index)}}
      catch(reason){results[index]={status:'rejected',reason}}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker))
  return results
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

  const emptyStats={directions:0,primaryDirections:0,adjacentDirections:0,searchRequests:0,searchFailures:0,searchRows:0,discovered:0}
  if(!directions.length) return {candidates:[],stats:emptyStats,coverage:{status:'NO DIRECTIONS',detail:null}}
  if(typeof fetcher!=='function') throw new Error('Shadow LinkedIn fetcher is required.')

  let searchRequests=0
  let searchFailures=0
  let searchRows=0
  let requestBudgetReached=false
  let pageLimitReached=false
  const errors=[]

  const searchGroups=groupDirections(directions)
  const byId=new Map()
  // Cover the current-day window first so wider retrieval cannot displace it.
  const windows=days===1?[1]:[1,days]
  for(const windowDays of windows){
    let eligible=[...searchGroups]
    for(let page=0;page<MAX_SEARCH_PAGES&&eligible.length;page++){
      const remaining=MAX_SEARCH_REQUESTS-searchRequests
      if(remaining<=0){requestBudgetReached=true;break}
      const scheduled=eligible.slice(0,remaining)
      if(scheduled.length<eligible.length)requestBudgetReached=true
      const start=page*SEARCH_PAGE_SIZE
      const settled=await mapLimit(scheduled,4,async group=>{
        const qs=new URLSearchParams({keywords:group.query,location:'Denmark',
          f_TPR:`r${windowDays*86400}`,sortBy:'DD',start:String(start)})
        const html=await fetcher(`${LINKEDIN_SEARCH}?${qs}`)
        return parseSearchHtml(html)
      })
      searchRequests+=scheduled.length
      const next=[]
      for(let i=0;i<scheduled.length;i++){
        const group=scheduled[i],item=settled[i]
        if(item.status==='rejected'){
          searchFailures++
          errors.push(String(item.reason?.message||item.reason))
          continue // Keep candidates from successful earlier pages.
        }
        const rows=item.value
        searchRows+=rows.length
        for(const row of rows){
          const jobId=text(row?.jobId)
          if(!jobId)continue
          if(!byId.has(jobId))byId.set(jobId,{...row,jobId,foundBy:[],__foundByKeys:new Set()})
          const candidate=byId.get(jobId)
          for(const direction of group.directions){
            const key=foundByKey(direction)
            if(candidate.__foundByKeys.has(key))continue
            candidate.__foundByKeys.add(key)
            candidate.foundBy.push(direction)
          }
        }
        if(rows.length>=SEARCH_PAGE_SIZE)next.push(group)
      }
      if(page===MAX_SEARCH_PAGES-1&&next.length)pageLimitReached=true
      eligible=next
      if(requestBudgetReached)break
    }
    if(requestBudgetReached)break
  }
  if(searchRequests>0&&searchFailures===searchRequests)throw new Error(`LinkedIn shadow search unavailable: ${errors[0]||'all search requests failed'}`)
  const candidates=[...byId.values()].map(({__foundByKeys,...candidate})=>candidate)
  const incomplete=searchFailures>0||requestBudgetReached||pageLimitReached
  const coverage=incomplete?'ACCESS LIMITED':candidates.length?'SEARCHED':'NO RELEVANT RESULTS'
  const detail=errors[0]||(requestBudgetReached?'LinkedIn discovery request budget reached; partial discovery retained':pageLimitReached?'LinkedIn discovery page limit reached; partial discovery retained':null)
  return {candidates,stats:{
    directions:directions.length,
    primaryDirections:directions.filter(d=>d.tier==='primary').length,
    adjacentDirections:directions.filter(d=>d.tier==='adjacent').length,
    searchRequests,searchFailures,searchRows,discovered:candidates.length,
    requestBudgetReached,pageLimitReached,
  },coverage:{status:coverage,detail}}
}
