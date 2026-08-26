import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('shadow route is authenticated, isolated from legacy engine, and accepts only shadow inputs',async()=>{
  const source=await readFile(new URL('../api/linkedin-shadow-search/route.js',import.meta.url),'utf8')
  assert.match(source,/requireUser/)
  assert.match(source,/createLinkedInStableFetcher/)
  assert.match(source,/searchLinkedInShadow/)
  assert.doesNotMatch(source,/searchLinkedInStable/)
  assert.match(source,/\[1,3,7,14\]/)
  assert.match(source,/unionSearchPlan/)
  assert.match(source,/searchLinkedInShadow\(\{freshnessDays,unionSearchPlan,fetcher:createLinkedInStableFetcher\(\)\}\)/)
})
