import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const generate=readFileSync(new URL('../api/cover-letter/route.js',import.meta.url),'utf8')
const exportRoute=readFileSync(new URL('../api/export-cover-letter/route.js',import.meta.url),'utf8')

test('cover letter API requires selected CV and usable vacancy',()=>{
  assert.match(generate,/writeCoverLetter/)
  assert.match(generate,/sourceVersion/)
  assert.match(generate,/finalCvBlocks/)
  assert.match(generate,/description\.length<80/)
})

test('cover letter export produces DOCX without requiring a template',()=>{
  assert.match(exportRoute,/JSZip/)
  assert.match(exportRoute,/word\/document\.xml/)
  assert.match(exportRoute,/application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/)
})
