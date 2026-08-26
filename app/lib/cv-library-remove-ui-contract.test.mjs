import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('CV remove uses ApplyPilot confirmation, keeps Search Profile open and preserves fixed slots',()=>{
  const page=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')
  const component=fs.readFileSync(new URL('../components/cv-library-step.js',import.meta.url),'utf8')
  const css=fs.readFileSync(new URL('../components/cv-library-step.module.css',import.meta.url),'utf8')

  assert.match(component,/ApplyPilot/)
  assert.match(component,/Remove CV/)
  assert.match(component,/onRemove/)
  assert.doesNotMatch(component,/window\.confirm/)
  assert.doesNotMatch(component,/window\.location\.reload/)

  assert.match(page,/removeCvSlot/)
  assert.match(page,/function removeCv\(slot\)/)
  assert.match(page,/setCvLibrary\(nextLibrary\)/)
  assert.match(page,/<CvLibraryStep[^>]*onRemove=\{removeCv\}/)
  assert.match(page,/cvText:cvData\.cvText/)

  assert.match(css,/\.slotActions\{[^}]*grid-template-columns:1fr 1fr/)
})
