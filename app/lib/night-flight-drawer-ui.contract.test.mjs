import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function source(path){
  try{
    return await readFile(new URL(`../${path}`,import.meta.url),'utf8')
  }catch{
    return ''
  }
}

test('Night Flight is mounted inside its own drawer shell',async()=>{
  const layout=await source('layout.js')
  const drawer=await source('components/night-flight-drawer.js')
  assert.match(layout,/NightFlightDrawer/)
  assert.match(layout,/<NightFlightDrawer>[\s\S]*<NightFlightMorningReview\s*\/>[\s\S]*<NightFlightSettings\s*\/>[\s\S]*<\/NightFlightDrawer>/)
  assert.match(drawer,/>NIGHT FLIGHT</)
  assert.match(drawer,/id="nightFlightReviewHost"/)
  assert.match(drawer,/id="nightFlightSettingsHost"/)
  assert.match(drawer,/>Morning Review</)
})

test('Morning Review no longer mounts into Search Profile',async()=>{
  const review=await source('components/night-flight-morning-review.js')
  assert.match(review,/document\.querySelector\(['"]#nightFlightReviewHost['"]\)/)
  assert.doesNotMatch(review,/document\.querySelector\(['"]\.profileStrip['"]\)/)
})

test('Night Flight settings no longer mount into the global header',async()=>{
  const settings=await source('components/night-flight-settings.js')
  assert.match(settings,/document\.querySelector\(['"]#nightFlightSettingsHost['"]\)/)
  assert.doesNotMatch(settings,/document\.querySelector\(['"]\.headerActions['"]\)/)
  assert.match(settings,/>NF Settings</)
})

test('Night Flight side tab is purple and independent of APPLIED',async()=>{
  const css=await source('components/night-flight-drawer.module.css')
  assert.match(css,/\.tab\{[^}]*position:fixed/)
  assert.match(css,/\.tab\{[^}]*left:0/)
  assert.match(css,/rgba\(124,58,237|#7c3aed|#a78bfa/)
  assert.match(css,/\.drawer\{[^}]*position:relative|\.drawer\{[^}]*height:100%/)
})
