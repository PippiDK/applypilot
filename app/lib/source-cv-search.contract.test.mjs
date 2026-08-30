import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const engine = readFileSync(new URL('./linkedin-search.js', import.meta.url), 'utf8')
const route = readFileSync(new URL('../api/linkedin-search/route.js', import.meta.url), 'utf8')
const page = readFileSync(new URL('../page.js', import.meta.url), 'utf8')

test('search engine has no hard-coded candidate CV fallback', () => {
  assert.equal(engine.includes('MASTER_CV_TEXT'), false)
  assert.doesNotMatch(engine, /resume\s*=\s*MASTER_/)
})

test('preserved LinkedIn legacy API still requires cvText and passes it into search evaluation', () => {
  assert.match(route, /body\?\.cvText/)
  assert.match(route, /Please Upload Your CV/)
  assert.match(route, /searchLinkedIn\(\{freshnessDays,resume:cvText,fetcher\}\)/)
})

test('Search is blocked in the browser when Source CV is not ready', () => {
  assert.match(page, /if\(!resumeLoaded\)/)
  assert.match(page, /Please Upload Your CV/)
  assert.match(page, /return/)
})

test('browser sends the active uploaded Source CV text to the multi-source endpoint', () => {
  assert.match(page, /\/api\/multi-source-search/)
  assert.match(page, /cvText:cvData\.cvText/)
})
