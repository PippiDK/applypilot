import { SEARCH_AREAS } from './job-list-filters.js'

export const NIGHT_FLIGHT_SOURCES=[
  {id:'linkedin',label:'LinkedIn'},
  {id:'jobindex',label:'Jobindex'},
  {id:'jobnet',label:'Jobnet'},
]

const SOURCE_IDS=new Set(NIGHT_FLIGHT_SOURCES.map(({id})=>id))
const AREA_IDS=new Set(SEARCH_AREAS.map(({id})=>id))

export const DEFAULT_NIGHT_FLIGHT_SETTINGS=Object.freeze({
  enabled:false,
  sources:Object.freeze(['linkedin','jobindex','jobnet']),
  areas:Object.freeze([]),
})

export class NightFlightSettingsValidationError extends Error{
  constructor(message){
    super(message)
    this.name='NightFlightSettingsValidationError'
  }
}

function normalizeList(value,fallback=[]){
  if(!Array.isArray(value)) return [...fallback]
  return [...new Set(value.map(item=>String(item??'').trim().toLowerCase()).filter(Boolean))]
}

export function normalizeNightFlightSettings(value){
  const raw=value&&typeof value==='object'?value:{}
  return {
    enabled:raw.enabled===true,
    sources:normalizeList(raw.sources,DEFAULT_NIGHT_FLIGHT_SETTINGS.sources),
    areas:normalizeList(raw.areas,DEFAULT_NIGHT_FLIGHT_SETTINGS.areas),
  }
}

export function validateNightFlightSettings(value){
  const settings=normalizeNightFlightSettings(value)
  if(settings.sources.length===0){
    throw new NightFlightSettingsValidationError('Select at least one source.')
  }
  for(const source of settings.sources){
    if(!SOURCE_IDS.has(source)) throw new NightFlightSettingsValidationError(`Unknown Night Flight source: ${source}`)
  }
  for(const area of settings.areas){
    if(!AREA_IDS.has(area)) throw new NightFlightSettingsValidationError(`Unknown Night Flight area: ${area}`)
  }
  return settings
}
