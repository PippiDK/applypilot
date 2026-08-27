import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
const routePath=new URL('../api/linkedin-profile-search/route.js',import.meta.url)

test('LIVE Search uses the profile-driven endpoint when a saved Union Search Plan exists',()=>{
  assert.match(page,/\/api\/linkedin-profile-search/)
  assert.match(page,/unionSearchPlan:profile\.unionSearchPlan/)
})

test('LIVE Search keeps the frozen legacy endpoint as fallback',()=>{
  assert.match(page,/\/api\/linkedin-search/)
})

test('profile-driven LIVE endpoint exists separately from the frozen legacy endpoint',()=>{
  assert.equal(fs.existsSync(routePath),true)
})
