import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync} from 'node:fs'

const componentPath='app/components/night-flight-settings.js'
const shellPath='app/components/sign-out-button.js'

test('Task 3 exposes Settings beside Help and renders the complete Night Flight settings UI',()=>{
  assert.equal(existsSync(componentPath),true,'Night Flight settings component must exist')
  const shell=readFileSync(shellPath,'utf8')
  const component=readFileSync(componentPath,'utf8')
  assert.match(shell,/NightFlightSettings/)
  assert.match(component,/SETTINGS/)
  assert.match(component,/Night Flight Settings/)
  assert.match(component,/Prepares matches from the last completed day overnight\./)
  assert.match(component,/Run Night Flight automatically/)
  for(const source of ['LinkedIn','Jobindex','Jobnet']) assert.match(component,new RegExp(source))
  for(const label of ['Copenhagen & North','Greater Copenhagen','North Zealand','Rest of Zealand','Aarhus & East Jutland']) assert.match(component,new RegExp(label.replace(/[&]/g,'\\&')))
  assert.match(component,/Select at least one source\./)
  assert.match(component,/Cancel/)
  assert.match(component,/Save/)
})

test('Task 3 has explicit Save semantics and no autosave-on-toggle wiring',()=>{
  const component=readFileSync(componentPath,'utf8')
  assert.match(component,/async function saveSettings/)
  assert.match(component,/method:\s*['"]PUT['"]/)
  assert.doesNotMatch(component,/useEffect\([^]*method:\s*['"]PUT['"]/)
})
