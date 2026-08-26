import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../globals.css',import.meta.url),'utf8')

test('Step 5 labels CV1 explicitly as the Primary Search CV',()=>{
  assert.match(page,/<span>Primary Search CV<\/span>/)
})

test('profile strip shows a dynamic saved Union Search Plan summary instead of legacy role and score copy',()=>{
  assert.match(page,/profile\??\.unionSearchPlan/)
  assert.match(page,/search directions/)
  assert.match(page,/primary/)
  assert.match(page,/adjacent/)
  assert.doesNotMatch(page,/JD responsibilities 40% · experience\/domain 25% · geography 20% · career level 15%/)
  assert.doesNotMatch(page,/profile\.roles\.split\(','\)\.slice\(0,2\)/)
})

test('Search and Shadow diagnostics live together at the bottom under AUDIT LOG with technical styling',()=>{
  const grid=page.indexOf('<section className="grid">')
  const auditLog=page.indexOf('<section className="auditLog">')
  const footer=page.indexOf('<footer>')
  assert.ok(grid>=0,'main results grid must exist')
  assert.ok(auditLog>grid,'AUDIT LOG must render after the main results grid')
  assert.ok(footer>auditLog,'AUDIT LOG must remain in the bottom page area before the footer')
  const auditBlock=page.slice(auditLog,footer)
  assert.match(auditBlock,/AUDIT LOG/)
  assert.match(auditBlock,/<SearchAudit audit=\{state\.audit\}\/>/)
  assert.match(auditBlock,/<ShadowSearchAudit shadowState=\{shadowState\}\/>/)
  assert.doesNotMatch(page.slice(0,grid),/<SearchAudit|<ShadowSearchAudit/)
  assert.match(css,/\.auditLog/)
  assert.match(css,/\.auditLogTitle/)
  assert.match(css,/ui-monospace|SFMono|monospace/)
})
