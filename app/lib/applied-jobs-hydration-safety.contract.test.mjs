import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const layoutPath=new URL('../layout.js',import.meta.url)

test('existing local Applied History wins duplicate job IDs during hydration',()=>{
  const source=readFileSync(layoutPath,'utf8')
  assert.match(source,/for\(const item of \[\.\.\.local,\.\.\.remote\]\)/)
  assert.doesNotMatch(source,/localStorage\.removeItem|localStorage\.clear\(/)
})
