import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const componentPath=new URL('../components/night-flight-settings.js',import.meta.url)
const layoutPath=new URL('../layout.js',import.meta.url)
const settingsPath=new URL('./night-flight-settings.js',import.meta.url)
const component=fs.existsSync(componentPath)?fs.readFileSync(componentPath,'utf8'):''
const layout=fs.readFileSync(layoutPath,'utf8')
const settingsSource=fs.readFileSync(settingsPath,'utf8')

test('drawer exposes compact Settings entry without changing Manual Search controls',()=>{
  assert.match(layout,/import NightFlightSettings from '\.\/components\/night-flight-settings\.js'/)
  assert.match(layout,/<NightFlightSettings\s*\/>/)
  assert.match(component,/document\.querySelector\('#nightFlightSettingsHost'\)/)
  assert.doesNotMatch(component,/document\.querySelector\('\.headerActions'\)/)
  assert.match(component,/>Settings<\/button>/)
  assert.doesNotMatch(component,/selectedSources|writeSearchSources|freshnessDays|setFreshnessDays/)
})

test('Night Flight Settings uses explicit All areas selection with existing SEARCH_AREAS',()=>{
  assert.match(component,/Night Flight Settings/)
  assert.match(component,/Prepares matches from the last completed day overnight\./)
  assert.match(component,/Run Night Flight automatically/)
  assert.match(component,/NIGHT_FLIGHT_SOURCES/)
  assert.match(settingsSource,/label:'LinkedIn'/)
  assert.match(settingsSource,/label:'Jobindex'/)
  assert.match(settingsSource,/label:'Jobnet'/)
  assert.match(component,/SEARCH_AREAS/)
  assert.match(component,/allAreaIds/)
  assert.match(component,/allAreasSelected/)
  assert.match(component,/toggleAllAreas/)
  assert.match(component,/>All areas<\/span>/)
  assert.doesNotMatch(component,/No areas selected = all areas/)
})

test('Night Flight Settings preserves backend all-areas contract while keeping UI explicit',()=>{
  assert.match(component,/expandAllAreas/)
  assert.match(component,/collapseAllAreas/)
  assert.match(component,/saveNightFlightSettings\(collapseAllAreas\(draft\)\)/)
  assert.match(component,/Select at least one area\./)
})

test('Night Flight Settings loads lazily and persists only through explicit Save',()=>{
  assert.match(component,/if\(!open\)\s*return/)
  assert.match(component,/requestNightFlightSettings/)
  assert.match(component,/saveNightFlightSettings/)
  assert.match(component,/>Save<\/button>/)
  assert.match(component,/>Cancel<\/button>/)
  assert.match(component,/Select at least one source\./)
})
