import {SEARCH_AREAS} from './job-list-filters.js'

export const NIGHT_FLIGHT_SOURCES=['linkedin','jobindex','jobnet']
export const NIGHT_FLIGHT_AREAS=SEARCH_AREAS.map(({id})=>id)

export const DEFAULT_NIGHT_FLIGHT_SETTINGS={
  enabled:false,
  sources:[...NIGHT_FLIGHT_SOURCES],
  areas:[]
}

const uniqueInOrder=(values,allowed)=>allowed.filter(value=>values.includes(value))

export function validateNightFlightSettings(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)){
    throw new Error('Night Flight settings payload must be an object.')
  }

  const sources=Array.isArray(payload.sources)?payload.sources.map(String):null
  const areas=Array.isArray(payload.areas)?payload.areas.map(String):null

  if(!sources) throw new Error('Night Flight sources must be an array.')
  if(!areas) throw new Error('Night Flight areas must be an array.')
  if(!sources.length) throw new Error('At least one Night Flight source is required.')

  const unsupportedSource=sources.find(source=>!NIGHT_FLIGHT_SOURCES.includes(source))
  if(unsupportedSource) throw new Error(`Unsupported Night Flight source: ${unsupportedSource}`)

  const unsupportedArea=areas.find(area=>!NIGHT_FLIGHT_AREAS.includes(area))
  if(unsupportedArea) throw new Error(`Unsupported Night Flight area: ${unsupportedArea}`)

  return true
}

export function normalizeNightFlightSettings(payload){
  validateNightFlightSettings(payload)
  return {
    enabled:payload.enabled===true,
    sources:uniqueInOrder([...new Set(payload.sources.map(String))],NIGHT_FLIGHT_SOURCES),
    areas:uniqueInOrder([...new Set(payload.areas.map(String))],NIGHT_FLIGHT_AREAS)
  }
}

export function settingsFromRow(row){
  if(!row) return {...DEFAULT_NIGHT_FLIGHT_SETTINGS,sources:[...DEFAULT_NIGHT_FLIGHT_SETTINGS.sources],areas:[]}
  return normalizeNightFlightSettings({
    enabled:row.enabled===true,
    sources:Array.isArray(row.sources)&&row.sources.length?row.sources:DEFAULT_NIGHT_FLIGHT_SETTINGS.sources,
    areas:Array.isArray(row.areas)?row.areas:[]
  })
}
