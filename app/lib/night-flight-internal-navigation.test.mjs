import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('Manual Control bypasses entry splash and retains entry on return',async()=>{
  const gate=await readFile(new URL('../components/splash-gate.js',import.meta.url),'utf8')
  assert.match(gate,/usePathname/)
  assert.match(gate,/if\(pathname==='\/night-flight-control'\) setEntered\(true\)/)
  assert.match(gate,/if\(entered\|\|pathname==='\/night-flight-control'\) return children/)
  assert.match(gate,/onClick=\{\(\)=>setEntered\(true\)\}/,'initial ApplyPilot splash still has an entry action')
})
test('both internal links use Next client navigation rather than full document reload',async()=>{
  const drawer=await readFile(new URL('../components/night-flight-drawer.js',import.meta.url),'utf8')
  const manual=await readFile(new URL('../night-flight-control/page.js',import.meta.url),'utf8')
  assert.match(drawer,/import Link from 'next\/link'/)
  assert.match(drawer,/<Link href="\/night-flight-control"/)
  assert.doesNotMatch(drawer,/<a href="\/night-flight-control"/)
  assert.match(manual,/import Link from 'next\/link'/)
  assert.match(manual,/<Link href="\/"/)
  assert.doesNotMatch(manual,/<a href="\/"/)
})
