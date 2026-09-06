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
  assert.match(settings,/>Settings</)
  assert.doesNotMatch(settings,/>NF Settings</)
})

test('Automation settings appear before Morning Review inside Night Flight',async()=>{
  const drawer=await source('components/night-flight-drawer.js')
  assert.match(drawer,/>Automation<[\s\S]*id="nightFlightSettingsHost"[\s\S]*>Morning Review<[\s\S]*id="nightFlightReviewHost"/)
})

test('Night Flight side tab is purple and independent of APPLIED',async()=>{
  const css=await source('components/night-flight-drawer.module.css')
  assert.match(css,/\.tab\{[^}]*position:fixed/)
  assert.match(css,/\.tab\{[^}]*left:0/)
  assert.match(css,/rgba\(124,58,237|#7c3aed|#a78bfa/)
  assert.match(css,/\.drawer\{[^}]*position:relative|\.drawer\{[^}]*height:100%/)
})

test('Night Flight tab matches APPLIED geometry while keeping purple identity',async()=>{
  const css=await source('components/night-flight-drawer.module.css')
  const desktop=css.match(/\.tab\{([^}]*)\}/)?.[1]||''
  const label=css.match(/\.tab span\{([^}]*)\}/)?.[1]||''

  assert.match(desktop,/top:60%/)
  assert.match(desktop,/flex-direction:column/)
  assert.match(desktop,/align-items:center/)
  assert.match(desktop,/gap:6px/)
  assert.match(desktop,/border-radius:0 12px 12px 0/)
  assert.match(desktop,/padding:12px 9px/)
  assert.doesNotMatch(desktop,/transform:/)
  assert.doesNotMatch(desktop,/writing-mode:/)

  assert.match(label,/font-size:9px/)
  assert.match(label,/letter-spacing:\.12em/)
  assert.match(label,/writing-mode:vertical-rl/)
  assert.match(label,/transform:rotate\(180deg\)/)

  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.tab\{[^}]*bottom:58px[^}]*border-radius:999px[^}]*flex-direction:row[^}]*padding:10px 14px/)
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.tab span\{[^}]*writing-mode:initial[^}]*transform:none/)
})

test('Morning Review card keeps Open Night Flight inside the drawer',async()=>{
  const css=await source('components/night-flight-morning-review.module.css')
  const card=css.match(/\.card\{([^}]*)\}/)?.[1]||''
  const open=css.match(/\.open\{([^}]*)\}/)?.[1]||''

  assert.match(card,/display:grid/)
  assert.match(card,/grid-template-columns:minmax\(0,1fr\) auto/)
  assert.match(card,/width:100%/)
  assert.match(card,/white-space:normal/)
  assert.doesNotMatch(card,/margin-left:auto/)
  assert.match(open,/white-space:nowrap/)
})
