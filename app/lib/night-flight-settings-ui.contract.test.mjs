import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const componentPath=new URL('../components/night-flight-settings.js',import.meta.url)
const pagePath=new URL('../page.js',import.meta.url)
const component=fs.existsSync(componentPath)?fs.readFileSync(componentPath,'utf8'):''
const page=fs.readFileSync(pagePath,'utf8')

test('header exposes compact Night Flight Settings entry without changing Manual Search controls',()=>{
  assert.match(page,/import NightFlightSettings from '\.\/components\/night-flight-settings\.js'/)
  assert.match(page,/<NightFlightSettings\s*\/>/)
  assert.match(component,/⚙️\s*Settings/)
  assert.doesNotMatch(component,/selectedSources|writeSearchSources|freshnessDays|setFreshnessDays/)
})

test('Night Flight Settings uses the approved controls and existing SEARCH_AREAS',()=>{
  assert.match(component,/Night Flight Settings/)
  assert.match(component,/Prepares matches from the last completed day overnight\./)
  assert.match(component,/Run Night Flight automatically/)
  assert.match(component,/LinkedIn/)
  assert.match(component,/Jobindex/)
  assert.match(component,/Jobnet/)
  assert.match(component,/SEARCH_AREAS/)
  assert.match(component,/No areas selected = all areas/)
})

test('Night Flight Settings loads lazily and persists only through explicit Save',()=>{
  assert.match(component,/if\(!open\)\s*return/)
  assert.match(component,/requestNightFlightSettings/)
  assert.match(component,/saveNightFlightSettings/)
  assert.match(component,/>Save<\/button>/)
  assert.match(component,/>Cancel<\/button>/)
  assert.match(component,/Select at least one source\./)
})
