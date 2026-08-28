import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const upload=readFileSync(new URL('../components/cv-library-step.js',import.meta.url),'utf8')
const route=readFileSync(new URL('../api/export-tailored-cv/route.js',import.meta.url),'utf8')
const pkg=readFileSync(new URL('../../package.json',import.meta.url),'utf8')

test('CV Library uses Word DOCX for source-file adaptation',()=>{
  assert.match(upload,/accept="\.docx"/)
  assert.doesNotMatch(upload,/accept="\.pdf,\.docx"/)
  assert.match(page,/Please upload a Word DOCX file\./)
})

test('source DOCX is kept only in session memory and can be re-uploaded',()=>{
  assert.match(page,/const \[sourceDocxFiles,setSourceDocxFiles\]=useState\(\{\}\)/)
  assert.doesNotMatch(page,/localStorage\.setItem\([^\n]*sourceDocxFiles/)
  assert.match(page,/Re-upload source DOCX/)
})

test('download is enabled only after review decisions and sends accepted blocks only',()=>{
  assert.match(page,/reviewedCount===reviewChanges\.length/)
  assert.match(page,/decisionFor\(change\.blockId\)===ADAPTATION_DECISION\.ACCEPTED/)
  assert.match(page,/Download tailored DOCX/)
  assert.match(page,/\/api\/export-tailored-cv/)
})

test('export route updates at most the three approved sections and returns DOCX without storage',()=>{
  assert.match(route,/JSZip/)
  assert.match(route,/replaceDocxBlocks/)
  assert.match(route,/requireUser/)
  assert.match(route,/replacements\.length>3/)
  assert.match(route,/Cache-Control':'no-store'/)
  assert.match(pkg,/"jszip": "\^3\.10\.1"/)
})
