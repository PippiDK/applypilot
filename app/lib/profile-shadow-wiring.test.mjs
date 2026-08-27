import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('page promotes the saved Union Search Plan to LIVE Search Run while preserving legacy fallback payload',async()=>{
  const source=await readFile(new URL('../page.js',import.meta.url),'utf8')
  const searchStart=source.indexOf('async function search(){')
  const searchEnd=source.indexOf('\n  function startProfile()',searchStart)
  assert.ok(searchStart>=0&&searchEnd>searchStart,'search() block must be found')
  const searchBlock=source.slice(searchStart,searchEnd)

  assert.match(searchBlock,/runProfileSearchRun\(\{/)
  assert.match(searchBlock,/unionSearchPlan:profile\.unionSearchPlan/)
  assert.match(searchBlock,/exclusionRules:Array\.isArray\(profile\.exclusionRules\)\?profile\.exclusionRules:\[\]/)
  assert.match(searchBlock,/\/api\/linkedin-search/)
  assert.match(searchBlock,/JSON\.stringify\(\{freshnessDays,cvText:cvData\.cvText\}\)/)
  assert.doesNotMatch(searchBlock,/\/api\/linkedin-shadow-search/)
  assert.match(searchBlock,/applySearchResult\(data\)/)
})
