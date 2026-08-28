import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../api/parse-cv/route.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../page.js', import.meta.url), 'utf8')
const cvLibraryStep = readFileSync(new URL('../components/cv-library-step.js', import.meta.url), 'utf8')
const sourceCv = readFileSync(new URL('./source-cv.js', import.meta.url), 'utf8')

test('parse-cv endpoint accepts resume uploads instead of being retired', () => {
  assert.equal(route.includes('status:410'), false)
  assert.match(route, /request\.formData\(\)/)
  assert.match(route, /8\*1024\*1024/)
  assert.match(route, /mammoth\.extractRawText/)
  assert.match(route, /PDFParse/)
  assert.match(route, /CanvasFactory/)
  assert.match(route, /facts/)
  assert.match(route, /skills/)
  assert.match(route, /cvText:text/)
  assert.match(route, /fileSize:file\.size/)
  assert.match(route, /\bfileType,/)
  assert.match(route, /sourceVersion/)
  assert.match(route, /createHash/)
  assert.match(route, /status:'ready'/)
})

test('Feature 2 UI persists the complete active Source CV and supports legacy migration', () => {
  assert.match(page, /\/api\/parse-cv/)
  assert.match(cvLibraryStep, /accept="\.docx"/)
  assert.match(page, /SOURCE_CV_STORAGE_KEY/)
  assert.match(page, /LEGACY_CV_STORAGE_KEY/)
  assert.match(page, /buildSourceCvRecord/)
  assert.match(page, /normalizeStoredSourceCv/)
  assert.match(page, /isSourceCvReady/)
  assert.match(page, /localStorage\.getItem\(SOURCE_CV_STORAGE_KEY\)/)
  assert.match(page, /localStorage\.getItem\(LEGACY_CV_STORAGE_KEY\)/)
  assert.match(page, /localStorage\.setItem\(SOURCE_CV_STORAGE_KEY/)
  assert.match(page, /localStorage\.removeItem\(LEGACY_CV_STORAGE_KEY\)/)
})


test('Feature 2 retains the extracted Professional Summary separately from the short preview', () => {
  assert.match(route, /extractSummaryFromText/)
  assert.match(route, /summary:extractSummaryFromText\(text\)/)
  assert.match(page, /buildSourceCvRecord\(data/)
  assert.match(sourceCv, /summary:text\(payload\.summary\)/)
  assert.match(sourceCv, /preview:text\(payload\.preview\)/)
})
