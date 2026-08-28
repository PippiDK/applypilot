import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const component=readFileSync(new URL('../components/best-cv-panel.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../ux-polish.css',import.meta.url),'utf8')

test('right panel mounts Best CV flow while UX polish orders Expertise Match first',()=>{
  assert.match(page,/import BestCvPanel/)
  assert.match(css,/\.expertiseHero\{[^}]*order:2/)
  assert.match(css,/\.cvWorkflowBest\{[^}]*order:3/)
})

test('Best CV component is manual, cached and has no Best CV percentage',()=>{
  assert.match(component,/CV FOR THIS JOB/)
  assert.match(component,/Find best CV/)
  assert.match(component,/runBestCv/)
  assert.match(component,/requestBestCv/)
  assert.match(component,/readBestCvCache/)
  assert.match(component,/writeBestCvCache/)
  assert.doesNotMatch(component,/bestCv[^\n]{0,80}%/i)
})

test('Best CV result is recommendation-only; selection remains a separate user choice',()=>{
  assert.match(component,/recommendedCvId/)
  assert.match(component,/USE AS IS/)
  assert.match(component,/UPDATE RECOMMENDED/)
  assert.match(component,/updateFocus/)
  assert.match(component,/rankedCvIds/)
  assert.doesNotMatch(component,/Use this CV|Selected for this job/)
  assert.doesNotMatch(component,/readBestCvSelection|writeBestCvSelection|useRecommendedCv/)
})

test('Best CV component cannot call Expertise Match or LinkedIn Search',()=>{
  assert.doesNotMatch(component,/requestExpertiseMatch|runExpertiseMatch/)
  assert.doesNotMatch(component,/searchLinkedIn|linkedin-search/)
})
