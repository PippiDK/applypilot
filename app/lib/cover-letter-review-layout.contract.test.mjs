import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../globals.css',import.meta.url),'utf8')

test('cover letter review keeps baseline, status and editor label visually separated',()=>{
  assert.match(page,/coverLetterReviewStatus/)
  assert.match(page,/coverLetterEditorLabel"><span>LETTER · EDITABLE<\/span>/)
  assert.match(css,/\.coverLetterModal \.reviewBaseline\{margin:10px 0 18px\}/)
  assert.match(css,/\.coverLetterReviewStatus\{[^}]*flex-direction:column[^}]*gap:6px/s)
  assert.match(css,/\.coverLetterReviewStatus b\{display:block/)
  assert.match(css,/\.coverLetterReviewStatus span\{display:block/)
})
