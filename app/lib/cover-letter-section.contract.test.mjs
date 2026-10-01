import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')

test('cover letter action lives in its own section above status-only application pack',()=>{
  assert.match(page,/className="section coverLetterSection"/)
  assert.match(page,/Generate cover letter/)
  assert.match(page,/View cover letter/)
  assert.match(page,/Application pack/)
  const pack=page.slice(page.indexOf('<div className="section"><h3>Application pack</h3>'))
  assert.doesNotMatch(pack,/coverLetterPackAction/)
  assert.doesNotMatch(pack,/>Generate</)
  assert.match(pack,/Complete CV update first/)
  assert.match(pack,/Not generated yet/)
})
