import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source=fs.readFileSync(new URL('../page.js',import.meta.url),'utf8')

test('Review CV changes runs the real JD Analyst before opening the preview review',()=>{
  assert.match(source,/requestJobAnalysis/)
  assert.match(source,/action.*analyze_job|openAiReview|runJobAnalysis/s)
  assert.doesNotMatch(source,/onClick=\{\(\)=>setReviewOpen\(true\)\}>Review CV changes/)
})

test('pretest review renders JD mission, priorities, must-haves and positioning',()=>{
  assert.match(source,/JD ANALYSIS PRETEST/)
  assert.match(source,/Role mission/)
  assert.match(source,/Hiring priorities/)
  assert.match(source,/Must-haves/)
  assert.match(source,/Candidate positioning/)
})

test('pretest labels the old Summary mechanism as legacy so it is not mistaken for Task 3 output',()=>{
  assert.match(source,/Legacy Summary preview · not Task 3/)
})
