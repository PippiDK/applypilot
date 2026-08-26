import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const layout=fs.readFileSync(new URL('../layout.js',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../v15-polish.css',import.meta.url),'utf8')

test('version badge is visible before search and preview includes short Vercel commit SHA',()=>{
  assert.match(layout,/VERCEL_ENV/)
  assert.match(layout,/VERCEL_GIT_COMMIT_SHA/)
  assert.match(layout,/V16/)
  assert.match(layout,/versionBadge/)
  assert.match(css,/\.versionBadge\s*\{/)
})
