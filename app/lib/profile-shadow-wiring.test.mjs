import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('page promotes the saved Union Search Plan through the multi-source endpoint',async()=>{
  const source=await readFile(new URL('../page.js',import.meta.url),'utf8')
  const searchStart=source.indexOf('async function search(){')
  const searchEnd=source.indexOf('\n  function startProfile()',searchStart)
  assert.ok(searchStart>=0&&searchEnd>searchStart,'search() block must be found')
  const searchBlock=source.slice(searchStart,searchEnd)

  assert.match(searchBlock,/\/api\/multi-source-search/)
  assert.match(searchBlock,/unionSearchPlan:profile\.unionSearchPlan/)
  assert.match(searchBlock,/exclusionRules:Array\.isArray\(profile\.exclusionRules\)\?profile\.exclusionRules:\[\]/)
  assert.match(searchBlock,/cvText:cvData\.cvText/)
  assert.match(searchBlock,/enabledSources:selectedSources/)
  assert.doesNotMatch(searchBlock,/\/api\/linkedin-shadow-search/)
  assert.doesNotMatch(searchBlock,/\/api\/linkedin-profile-search/)
  assert.doesNotMatch(searchBlock,/\/api\/linkedin-search/)
  assert.match(searchBlock,/setJobs\(Array\.isArray\(data\.jobs\)\?data\.jobs:\[\]\)/)
})
