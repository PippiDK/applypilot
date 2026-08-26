export const LOCATION_OPTIONS=['Denmark','EU/EMEA','Worldwide']
export const WORK_MODEL_OPTIONS=['hybrid','onsite','remote']

const text=value=>String(value??'').trim()
const unique=items=>[...new Set(items.filter(Boolean))]

function normalizeLocation(value){
  const raw=text(value)
  const lower=raw.toLowerCase()
  if(lower==='denmark'||lower.includes('denmark')) return 'Denmark'
  if(lower==='eu/emea'||lower.includes('eu/emea')||lower.includes('emea')) return 'EU/EMEA'
  if(lower==='worldwide'||lower.includes('worldwide')) return 'Worldwide'
  return ''
}

function normalizeWorkModel(value){
  const lower=text(value).toLowerCase()
  if(lower==='hybrid'||lower.includes('hybrid')) return 'hybrid'
  if(lower==='onsite'||lower==='on-site'||lower.includes('onsite')||lower.includes('on-site')) return 'onsite'
  if(lower==='remote'||lower.includes('remote')) return 'remote'
  return ''
}

function normalizeExplicit(values,normalizer,order){
  const set=new Set((Array.isArray(values)?values:[]).map(normalizer).filter(Boolean))
  return order.filter(value=>set.has(value))
}

export function normalizeSearchPreferences(profile={}){
  const value=profile&&typeof profile==='object'?profile:{}
  const hasLocations=Object.prototype.hasOwnProperty.call(value,'locations')
  const hasWorkModels=Object.prototype.hasOwnProperty.call(value,'workModels')
  const legacy=Array.isArray(value.geography)?value.geography:[]

  const locations=hasLocations
    ? normalizeExplicit(value.locations,normalizeLocation,LOCATION_OPTIONS)
    : normalizeExplicit(legacy,normalizeLocation,LOCATION_OPTIONS)

  const workModels=hasWorkModels
    ? normalizeExplicit(value.workModels,normalizeWorkModel,WORK_MODEL_OPTIONS)
    : normalizeExplicit(legacy,normalizeWorkModel,WORK_MODEL_OPTIONS)

  return {locations,workModels}
}

export function legacyGeographyFromPreferences(locations=[],workModels=[]){
  return unique([
    ...normalizeExplicit(locations,normalizeLocation,LOCATION_OPTIONS),
    ...normalizeExplicit(workModels,normalizeWorkModel,WORK_MODEL_OPTIONS)
  ])
}
