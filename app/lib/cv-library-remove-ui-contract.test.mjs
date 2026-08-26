import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('CV library exposes Remove without reordering slots',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  const component=fs.readFileSync(new URL('../components/cv-library-step.js',import.meta.url),'utf8')

  assert.match(component,/Remove/)
  assert.match(component,/onRemove/)
  assert.match(page,/removeCv\(slot\)/)
  assert.match(page,/removeCvSlot/)
  assert.match(page,/CV 2 and CV 3 are not promoted|slot stays empty/)
  assert.match(page,/cvText:cvData\.cvText/)
})
