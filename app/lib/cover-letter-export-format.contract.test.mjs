import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const route=readFileSync(new URL('../api/export-cover-letter/route.js',import.meta.url),'utf8')

test('cover letter export uses selected CV identity and exact JD title',()=>{
  assert.match(page,/jobTitle:active\.job\.title/)
  assert.match(page,/cvText:activeAdaptationBaseline\.cvText/)
  assert.match(route,/extractCvContactDetails\(cvText\)/)
  assert.match(route,/headerTableXml\(contact\.name,text\(jobTitle\)\)/)
})

test('signature comes from selected CV and LinkedIn is optional',()=>{
  assert.match(route,/contact\.name\?paragraphXml\(contact\.name/)
  assert.match(route,/contact\.email\?paragraphXml\(contact\.email/)
  assert.match(route,/contact\.phone\?paragraphXml\(contact\.phone/)
  assert.match(route,/contact\.linkedIn\?paragraphXml\(contact\.linkedIn/)
})

test('v1 cover letter export has no generated date block',()=>{
  assert.doesNotMatch(route,/toLocaleDateString|new Date\(/)
})
