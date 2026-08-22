import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../api/parse-cv/route.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../page.js', import.meta.url), 'utf8')

test('parse-cv endpoint accepts resume uploads instead of being retired', () => {
  assert.equal(route.includes('status:410'), false)
  assert.match(route, /request\.formData\(\)/)
  assert.match(route, /8\*1024\*1024/)
  assert.match(route, /mammoth\.extractRawText/)
  assert.match(route, /PDFParse/)
  assert.match(route, /CanvasFactory/)
  assert.match(route, /facts/)
  assert.match(route, /skills/)
})

test('current UI exposes PDF DOCX resume upload and saves parsed Fact Bank locally', () => {
  assert.match(page, /\/api\/parse-cv/)
  assert.match(page, /accept="\.pdf,\.docx"/)
  assert.match(page, /applypilot-master-cv/)
  assert.match(page, /facts/)
})
