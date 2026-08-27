import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const runRoutePath=new URL('../api/linkedin-profile-search/run/route.js',import.meta.url)
const discoverRoutePath=new URL('../api/linkedin-profile-search/discover/route.js',import.meta.url)
const processRoutePath=new URL('../api/linkedin-profile-search/process/route.js',import.meta.url)

test('LIVE Search uses the persistent profile Search Run when a saved Union Search Plan exists',()=>{
  assert.match(page,/runProfileSearchRun\(\{/)
  assert.match(page,/unionSearchPlan:profile\.unionSearchPlan/)
})

test('LIVE Search keeps the frozen legacy endpoint as fallback',()=>{
  assert.match(page,/\/api\/linkedin-search/)
})

test('profile-driven LIVE Search Run endpoints exist separately from the frozen legacy endpoint',()=>{
  assert.equal(fs.existsSync(runRoutePath),true)
  assert.equal(fs.existsSync(discoverRoutePath),true)
  assert.equal(fs.existsSync(processRoutePath),true)
})

test('LIVE meta keeps the established worthwhile-after-evaluation stats contract',()=>{
  assert.match(page,/state\.stats\.evaluated}<\/b> worthwhile after evaluation/)
})
