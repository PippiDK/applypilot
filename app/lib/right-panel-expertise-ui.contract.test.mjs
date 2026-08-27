import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
const css=readFileSync(new URL('../globals.css',import.meta.url),'utf8')

test('right panel keeps dedicated Expertise Match logic but labels it MATCH CV AND JD',()=>{
  assert.match(page,/requestExpertiseMatch/)
  assert.match(page,/evaluateJobConditions/)
  assert.match(page,/MATCH CV AND JD/)
  assert.match(page,/How closely your CV experience matches the full job description/)
  assert.match(page,/>Match CV and JD</)
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

test('right panel preserves Application Pack and gives CV-JD match stronger visual hierarchy',()=>{
  assert.match(page,/Application pack/)
  assert.match(css,/\.expertiseHero/)
  assert.match(css,/\.expertiseScore/)
  assert.match(css,/\.conditionGrid/)
  assert.match(css,/\.conditionCard/)
})
