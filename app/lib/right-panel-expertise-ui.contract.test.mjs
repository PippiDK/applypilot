import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../globals.css',import.meta.url),'utf8')

test('right panel uses dedicated Expertise Match analysis and keeps the agreed vacancy header',()=>{
  assert.match(page,/requestExpertiseMatch/)
  assert.match(page,/evaluateJobConditions/)
  assert.match(page,/EXPERTISE MATCH/)
  assert.match(page,/Why you fit/)
  assert.match(page,/Transferable strengths/)
  assert.match(page,/Expertise gaps/)
  assert.match(page,/Expertise breakdown/)
  assert.match(page,/Source: LinkedIn/)
})

test('right panel renders the four smaller independent job-condition indicators and no Overall Match',()=>{
  assert.match(page,/>Area</)
  assert.match(page,/>Salary</)
  assert.match(page,/>Employment type</)
  assert.match(page,/>Work model</)
  assert.doesNotMatch(page,/Overall Match/i)
})

test('right panel preserves Application Pack and gives Expertise Match stronger visual hierarchy',()=>{
  assert.match(page,/Application pack/)
  assert.match(css,/\.expertiseHero/)
  assert.match(css,/\.expertiseScore/)
  assert.match(css,/\.conditionGrid/)
  assert.match(css,/\.conditionCard/)
})
