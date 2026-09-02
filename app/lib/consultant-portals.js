export const CONSULTANT_PORTAL_STORAGE_KEY='applypilot-consultant-portals-v1'

export const CONSULTANT_PORTALS=[
  {id:'emagine',name:'emagine',status:'connected',connector:'html',baseUrl:'https://portal.emagine.org',listingPath:'/jobs',detailPattern:'/jobs/'},
  {id:'7n',name:'7N',status:'pending'},
  {id:'epico',name:'EPICO',status:'pending'},
  {id:'right-people-group',name:'Right People Group',status:'connected',connector:'html',baseUrl:'https://rightpeoplegroup.com',listingPath:'/open-assignments',detailPattern:'/open-assignments/'},
  {id:'twins-consulting',name:'Twins Consulting',status:'pending'},
]

export function defaultConsultantPortals(){return {enabled:true,selected:CONSULTANT_PORTALS.map(({id})=>id)}}

export function normalizeConsultantPortals(value={}){
  const allowed=new Set(CONSULTANT_PORTALS.map(({id})=>id))
  const selected=Array.isArray(value?.selected)?value.selected.filter(id=>allowed.has(id)):CONSULTANT_PORTALS.map(({id})=>id)
  return {enabled:value?.enabled!==false,selected:[...new Set(selected)]}
}

export function readConsultantPortals(storage){
  if(!storage?.getItem)return defaultConsultantPortals()
  try{
    const raw=storage.getItem(CONSULTANT_PORTAL_STORAGE_KEY)
    return raw?normalizeConsultantPortals(JSON.parse(raw)):defaultConsultantPortals()
  }catch{return defaultConsultantPortals()}
}

export function writeConsultantPortals(storage,value){
  const next=normalizeConsultantPortals(value)
  try{storage?.setItem?.(CONSULTANT_PORTAL_STORAGE_KEY,JSON.stringify(next))}catch{}
  return next
}


export function consultantPortal(id){return CONSULTANT_PORTALS.find(portal=>portal.id===id)||null}
export function connectedConsultantPortalIds(){return CONSULTANT_PORTALS.filter(portal=>portal.status==='connected').map(portal=>portal.id)}
