import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('CV library exposes Remove and keeps fixed slot identity',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  const component=fs.readFileSync(new URL('../components/cv-library-step.js',import.meta.url),'utf8')

  assert.match(component,/Remove/)
  assert.match(component,/Remove this CV\?/)
  assert.match(component,/removeCvSlot/)
  assert.match(component,/CV_LIBRARY_STORAGE_KEY/)
  assert.match(component,/SOURCE_CV_STORAGE_KEY/)
  assert.match(component,/window\.location\.reload/)
  assert.match(page,/cvText:cvData\.cvText/)
})
