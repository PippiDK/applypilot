import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const base=readFileSync(new URL('../main-search-base.js',import.meta.url),'utf8')
const reuse=readFileSync(new URL('./night-flight-expertise-reuse.js',import.meta.url),'utf8')

test('F1-F3 Main Search reuses the existing Night Flight index without a new endpoint',()=>{
  assert.match(page,/fetch\('\/api\/night-flight-index'\)/)
  assert.match(page,/resolveNightFlightExpertise/)
})

test('F1-F3 reuse is CV-version compatible and read-only',()=>{
  assert.match(page,/currentCvSourceVersion/)
  assert.match(page,/sourceVersion:currentCvSourceVersion/)
  assert.match(base,/data-cv-source-version=\{cvData\?\.sourceVersion\|\|''\}/)
  assert.match(reuse,/cvSourceVersion/)
})

test('F3 successful Night Flight reuse never invokes Expertise Match generation',()=>{
  assert.doesNotMatch(page,/requestExpertiseMatch\(/)
  assert.doesNotMatch(reuse,/requestExpertiseMatch|analyzeExpertiseMatch|getOrCreateExpertiseMatch/)
})

test('F3 existing manual Expertise Match path remains available unchanged',()=>{
  assert.match(base,/async function runExpertiseMatch\(\)/)
  assert.match(base,/requestExpertiseMatch\(\{job:active\.job,cvText:cvData\.cvText\}\)/)
  assert.match(base,/Run Expertise Match/)
  assert.match(base,/onClick=\{runExpertiseMatch\}/)
})
