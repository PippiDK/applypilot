import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const pagePath=new URL('../page.js',import.meta.url)
const componentPath=new URL('../components/search-audit.js',import.meta.url)

test('page wires aggregated API audit rows into a closed-by-default Search Audit component',async()=>{
  const [page,component]=await Promise.all([
    readFile(pagePath,'utf8'),
    readFile(componentPath,'utf8'),
  ])
  assert.match(page,/import SearchAudit from '\.\/components\/search-audit\.js'/)
  assert.match(page,/const audit=successful\.flatMap/)
  assert.match(page,/Array\.isArray\(result\.data\.audit\)\?result\.data\.audit:\[\]/)
  assert.match(page,/<SearchAudit audit=\{state\.audit\}\/>/)
  assert.match(component,/<details className="searchAudit">/)
  assert.doesNotMatch(component,/<details[^>]*\bopen\b/)
  assert.match(component,/Search audit/)
  assert.match(component,/Stage/)
  assert.match(component,/Decision/)
  assert.match(component,/Reason/)
})
