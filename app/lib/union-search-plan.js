const text=value=>String(value??'').replace(/\s+/g,' ').trim()
const roleKey=value=>text(value).toLowerCase()

export const UNION_SEARCH_PLAN_VERSION='union-search-plan-v1'

function cleanRoles(values=[]){
  const out=[]
  const seen=new Set()
  for(const raw of Array.isArray(values)?values:[]){
    const role=text(raw)
    const key=roleKey(role)
    if(!key||seen.has(key)) continue
    seen.add(key)
    out.push({key,role})
  }
  return out
}

function unique(values=[]){
  const out=[]
  const seen=new Set()
  for(const raw of values){
    const value=text(raw)
    if(!value||seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function uniqueSupport(values=[]){
  const out=[]
  const seen=new Set()
  for(const raw of Array.isArray(values)?values:[]){
    const cvId=text(raw?.cvId)
    const kind=text(raw?.kind)
    if(!cvId||!kind) continue
    const key=`${cvId}|${kind}`
    if(seen.has(key)) continue
    seen.add(key)
    out.push({cvId,kind})
  }
  return out
}

function buildSourceMap(roleSources=[]){
  const map=new Map()
  for(const raw of Array.isArray(roleSources)?roleSources:[]){
    const key=roleKey(raw?.role)
    if(!key) continue
    if(!map.has(key)) map.set(key,{cvIds:[],support:[]})
    const current=map.get(key)
    current.support=uniqueSupport([...current.support,...(Array.isArray(raw?.support)?raw.support:[])])
    current.cvIds=unique([
      ...current.cvIds,
      ...(Array.isArray(raw?.cvIds)?raw.cvIds:[]),
      ...current.support.map(item=>item.cvId)
    ])
  }
  return map
}

function hashString(value=''){
  let hash=2166136261
  const input=String(value)
  for(let i=0;i<input.length;i++){
    hash^=input.charCodeAt(i)
    hash=Math.imul(hash,16777619)
  }
  return (hash>>>0).toString(16).padStart(8,'0')
}

export function buildUnionSearchPlan({primaryRoles=[],adjacentRoles=[],roleSources=[],cvRoleProfiles=[]}={}){
  const primary=cleanRoles(primaryRoles)
  const primaryKeys=new Set(primary.map(item=>item.key))
  const adjacent=cleanRoles(adjacentRoles).filter(item=>!primaryKeys.has(item.key))
  const sourceMap=buildSourceMap(roleSources)
  const slotByCvId=new Map()

  for(const profile of Array.isArray(cvRoleProfiles)?cvRoleProfiles:[]){
    const cvId=text(profile?.cvId)
    const slot=Number(profile?.slot)
    if(cvId&&Number.isFinite(slot)&&slot>0&&!slotByCvId.has(cvId)) slotByCvId.set(cvId,slot)
  }

  const directions=[
    ...primary.map(item=>({...item,tier:'primary'})),
    ...adjacent.map(item=>({...item,tier:'adjacent'}))
  ].map(item=>{
    const source=sourceMap.get(item.key)
    const support=source?uniqueSupport(source.support):[]
    const cvIds=source?unique([...(source.cvIds||[]),...support.map(entry=>entry.cvId)]):[]
    const cvSlots=[]
    const seenSlots=new Set()
    for(const cvId of cvIds){
      const slot=slotByCvId.get(cvId)
      if(!slot||seenSlots.has(slot)) continue
      seenSlots.add(slot)
      cvSlots.push(slot)
    }
    const origin=(cvIds.length||support.length)?'cv':'manual'
    return {
      key:item.key,
      role:item.role,
      tier:item.tier,
      origin,
      cvIds:origin==='cv'?cvIds:[],
      cvSlots:origin==='cv'?cvSlots:[],
      support:origin==='cv'?support:[]
    }
  })

  const fingerprintPayload=directions.map(direction=>({
    key:direction.key,
    tier:direction.tier,
    cvIds:direction.cvIds,
    support:direction.support
  }))
  const fingerprint=`usp1-${hashString(JSON.stringify([UNION_SEARCH_PLAN_VERSION,fingerprintPayload]))}`

  return {
    version:UNION_SEARCH_PLAN_VERSION,
    fingerprint,
    primaryCount:primary.length,
    adjacentCount:adjacent.length,
    totalCount:directions.length,
    directions
  }
}
