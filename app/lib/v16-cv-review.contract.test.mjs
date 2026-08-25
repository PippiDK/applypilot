import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('CV Update Review reuses cached JD analysis before calling OpenAI',()=>{
  assert.match(source,/readJobAnalysisCache/)
  assert.match(source,/writeJobAnalysisCache/)
  const run=source.match(/async function runJobAnalysis\(\)\{([\s\S]*?)\n  \}/)?.[1]||''
  assert.match(run,/readJobAnalysisCache/)
  assert.match(run,/if\(cached\)/)
  assert.match(run,/requestJobAnalysis/)
  assert.ok(run.indexOf('readJobAnalysisCache') < run.indexOf('requestJobAnalysis'))
})

test('CV Update Review removes dashboard and large Truth Guard panel',()=>{
  const review=source.split('{reviewOpen&&active&&')[1]||''
  assert.doesNotMatch(review,/className="reviewDashboard"/)
  assert.doesNotMatch(review,/className="truth compact"/)
  assert.match(review,/Truth Guard active · 0 unsupported claims/)
})

test('JD evidence is collapsed by default in Hiring priorities and Must-haves',()=>{
  const review=source.split('{reviewOpen&&active&&')[1]||''
  assert.match(review,/<details className="jdPriority"/)
  assert.match(review,/<details className="jdMustHave"/)
  assert.match(review,/View JD evidence/)
})

test('CV change card keeps original updated why and decisions but removes repeated source card',()=>{
  const review=source.split('{reviewOpen&&active&&')[1]||''
  assert.match(review,/ORIGINAL/)
  assert.match(review,/UPDATED/)
  assert.match(review,/WHY CHANGED/)
  assert.match(review,/Keep original/)
  assert.match(review,/Accept change/)
  assert.doesNotMatch(review,/<small>SOURCE<\/small>/)
})
