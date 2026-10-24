import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('manual page shows scoped spinner for retry, resume and start',async()=>{
  const page=await readFile(new URL('../night-flight-control/page.js',import.meta.url),'utf8')
  const css=await readFile(new URL('../night-flight-control/manual-progress.module.css',import.meta.url),'utf8')
  assert.match(page,/activeRequest\?\.mode==='retry'&&activeRequest\.runId===run\.id&&activeRequest\.jobKey===job\.jobKey/)
  assert.match(page,/activeRequest\?\.mode==='resume'&&activeRequest\.runId===run\.id/)
  assert.match(page,/activeRequest\?\.mode==='start'/)
  assert.match(page,/setInterval\(tick,1000\)/)
  assert.match(page,/return \(\)=>clearInterval\(timer\)/)
  assert.match(page,/role="status"/)
  assert.match(page,/finally\{await refresh\(\);setBusy\(false\);setActiveRequest\(null\)\}/)
  assert.match(css,/@keyframes manualSpinner/)
  assert.match(css,/prefers-reduced-motion/)
})
