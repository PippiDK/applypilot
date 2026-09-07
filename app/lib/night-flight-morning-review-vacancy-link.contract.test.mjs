import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const reviewPath=new URL('../components/night-flight-morning-review.js',import.meta.url)
const pagePath=new URL('../page.js',import.meta.url)

const review=fs.readFileSync(reviewPath,'utf8')
const page=fs.readFileSync(pagePath,'utf8')

test('Night Flight Morning Review reuses the ordinary search vacancy URL contract',()=>{
  assert.match(page,/href=\{job\.originalUrl\|\|job\.detailUrl\|\|job\.applicationUrl\}/)
  assert.match(review,/selected\?\.job\?\.originalUrl\|\|selected\?\.job\?\.detailUrl\|\|selected\?\.job\?\.applicationUrl/)
})

test('Night Flight shows Open vacancy beside Profile Match for the selected job',()=>{
  assert.match(review,/matchHeader/)
  assert.match(review,/Profile Match/)
  assert.match(review,/>Open vacancy<\/a>/)
  assert.match(review,/target="_blank"/)
  assert.match(review,/rel="noreferrer"/)
})
