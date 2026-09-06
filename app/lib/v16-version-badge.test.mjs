import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const layout=fs.readFileSync(new URL('../layout.js',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../v15-polish.css',import.meta.url),'utf8')

test('Task 13 version badge remains visible without any visual-style change',()=>{
  assert.match(layout,/versionBadge/)
  assert.match(css,/\.versionBadge\s*\{/)
})

test('Task 13 preview badge identifies V18 PREVIEW and deployment commit SHA',()=>{
  assert.match(layout,/VERCEL_ENV/)
  assert.match(layout,/VERCEL_GIT_COMMIT_SHA/)
  assert.match(layout,/V18\s*·\s*PREVIEW/)
  assert.match(layout,/slice\(0,\s*7\)/)
})

test('Task 13 production badge identifies LIVE 18 and deployment commit SHA',()=>{
  assert.match(layout,/LIVE 18/)
  assert.match(layout,/VERCEL_GIT_COMMIT_SHA/)
})

test('Task 13 removes stale hard-coded release labels and commit SHA',()=>{
  assert.doesNotMatch(layout,/V16\s*·\s*PREVIEW/)
  assert.doesNotMatch(layout,/LIVE 17/)
  assert.doesNotMatch(layout,/6a5f02c/)
})
