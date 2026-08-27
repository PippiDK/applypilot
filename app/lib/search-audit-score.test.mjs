import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../components/search-audit.js',import.meta.url),'utf8')
const match=source.match(/function scoreText\(value\)\{([\s\S]*?)\n\}/)
assert.ok(match,'scoreText function must remain directly testable')
const scoreText=new Function('value',match[1])

test('profile-driven 0-10 audit score is displayed as a percentage',()=>{
  assert.equal(scoreText(9.1),'91%')
  assert.equal(scoreText(7.7),'77%')
})

test('legacy 0-100 audit score remains unchanged',()=>{
  assert.equal(scoreText(74),'74%')
})

test('missing audit score remains an em dash',()=>{
  assert.equal(scoreText(null),'—')
})
