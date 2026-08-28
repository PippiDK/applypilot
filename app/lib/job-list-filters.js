const norm=value=>String(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/å/g,'a').replace(/[–—]/g,'-').replace(/\s+/g,' ').trim()

export const SEARCH_AREAS=[
  {id:'copenhagen_north',label:'Copenhagen & North'},
  {id:'greater_copenhagen',label:'Greater Copenhagen'},
  {id:'north_zealand',label:'North Zealand'},
  {id:'rest_zealand',label:'Rest of Zealand'},
  {id:'aarhus_east_jutland',label:'Aarhus & East Jutland'},
  {id:'central_jutland',label:'Central Jutland'},
  {id:'south_jutland',label:'South Jutland'},
  {id:'north_jutland',label:'North Jutland'},
  {id:'funen',label:'Funen'},
  {id:'bornholm',label:'Bornholm'},
]

export const WORK_MODELS=[
  {id:'dk_hybrid',label:'Hybrid'},
  {id:'dk_onsite',label:'On-site'},
  {id:'remote',label:'Remote'},
  {id:'dk_remote',label:'Denmark'},
  {id:'eu_remote_denmark',label:'EU / Europe — available from Denmark'},
]

const AREA_ALIASES={
  greater_copenhagen:['greater copenhagen','ballerup','herlev','gladsaxe','soborg','rodovre','brondby','glostrup','taastrup','hoje-taastrup','hedehusene','albertslund','ishoj','vallensbaek','bagsvaerd','skovlunde','smorum'],
  copenhagen_north:['copenhagen metropolitan area','copenhagen','kobenhavn','frederiksberg','hellerup','gentofte','kongens lyngby','lyngby','virum','holte','naerum','vedbaek','horsholm','charlottenlund','klampenborg'],
  north_zealand:['north zealand','nordsjaelland','allerod','hillerod','birkerod','farum','frederikssund','helsingor','humlebaek','fredensborg','graested','gilleleje','frederiksvaerk','helsinge'],
  rest_zealand:['region zealand','zealand, denmark','roskilde','koge','ringsted','slagelse','naestved','holbaek','kalundborg','soro','vordingborg','greve'],
  aarhus_east_jutland:['aarhus','arhus','skanderborg','horsens','silkeborg','randers','hinnerup'],
  central_jutland:['central denmark region','herning','ikast','viborg','billund','holstebro'],
  south_jutland:['vejle','kolding','fredericia','esbjerg','sonderborg','nordborg','aabenraa','haderslev'],
  north_jutland:['north denmark region','nordjylland','aalborg','hjorring','frederikshavn','bronderslev','thisted'],
  funen:['funen','fyn','odense','middelfart','svendborg','nyborg','faaborg','assens'],
  bornholm:['bornholm','ronne'],
}

export function classifySearchArea(job={}){
  const location=norm(job.location)
  if(!location) return null
  for(const [area,aliases] of Object.entries(AREA_ALIASES)) if(aliases.some(alias=>location.includes(alias))) return area
  if(location.includes('capital region of denmark')) return 'greater_copenhagen'
  if(location.includes('region of southern denmark')) return 'south_jutland'
  return null
}

function isDenmarkJob(job={}){
  const country=norm(job.country)
  const location=norm(job.location)
  return country==='denmark'||country==='dk'||country==='danmark'||location.includes('denmark')||location.includes('danmark')||Boolean(classifySearchArea(job))
}

export function classifyWorkModel(job={}){
  const type=norm(job.remoteType)
  if(type==='remote'){
    if(isDenmarkJob(job)) return 'dk_remote'
    if(norm(job.remoteEligibility)==='denmark confirmed') return 'eu_remote_denmark'
    return null
  }
  if(!isDenmarkJob(job)) return null
  if(type==='hybrid') return 'dk_hybrid'
  if(type==='onsite'||type==='on-site'||type==='on site') return 'dk_onsite'
  return null
}

export function filterJobItems(items=[],selectedAreas=[],selectedWorkModels=[]){
  const areaSet=new Set(selectedAreas)
  const workSet=new Set(selectedWorkModels)
  const allAreas=SEARCH_AREAS.every(({id})=>areaSet.has(id))
  const allWorkModels=WORK_MODELS.every(({id})=>workSet.has(id))
  if(allAreas&&allWorkModels) return items

  return items.filter(item=>{
    const job=item?.job||{}
    const workModel=classifyWorkModel(job)
    if(workModel==='dk_remote'||workModel==='eu_remote_denmark') return allWorkModels||(workSet.has('remote')&&workSet.has(workModel))

    const area=classifySearchArea(job)
    const areaMatch=allAreas||(area&&areaSet.has(area))
    const workMatch=allWorkModels||(workModel&&workSet.has(workModel))
    return Boolean(areaMatch&&workMatch)
  })
}
