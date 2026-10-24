import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {NIGHT_FLIGHT_EXECUTION_ENABLED} from './night-flight-execution.js'

const read=path=>readFile(new URL(path,import.meta.url),'utf8')

test('Night Flight execution gate is disabled and Vercel has zero scheduled crons',async()=>{
  assert.equal(NIGHT_FLIGHT_EXECUTION_ENABLED,false)
  const config=JSON.parse(await read('../../vercel.json'))
  assert.ok(!('crons' in config))
})

test('Every production Night Flight execution entry point checks the pause gate before running work',async()=>{
  for(const path of [
    '../api/cron/night-flight/route.js',
    '../api/cron/night-flight-worker/route.js',
    '../api/night-flight-manual/route.js',
    '../api/night-flight-review/route.js',
    '../api/night-flight-settings/route.js',
  ]){
    const source=await read(path)
    assert.match(source,/NIGHT_FLIGHT_EXECUTION_ENABLED/)
    assert.match(source,/if\(!NIGHT_FLIGHT_EXECUTION_ENABLED\) return NextResponse\.json/)
  }
})

test('Night Flight remains visible with read-only history and disabled action buttons',async()=>{
  const [layout,drawer,manual,review,settings,index]=await Promise.all([
    read('../layout.js'),read('../components/night-flight-drawer.js'),
    read('../night-flight-control/page.js'),read('../components/night-flight-morning-review.js'),
    read('../components/night-flight-settings.js'),read('../api/night-flight-index/route.js'),
  ])
  assert.match(layout,/<NightFlightDrawer>/)
  assert.match(drawer,/Manual Control/)
  assert.match(manual,/Night Flight is paused/)
  assert.match(review,/PAUSED/)
  assert.match(settings,/read-only/)
  assert.match(review,/fetchNightFlightReview/)
  assert.match(index,/loadNightFlightIndex/)
  assert.match(manual,/disabled=\{busy\|\|!NIGHT_FLIGHT_EXECUTION_ENABLED\}/)
  assert.match(review,/disabled=\{!NIGHT_FLIGHT_EXECUTION_ENABLED\|\|recoveringKey===selected.key\}/)
})
