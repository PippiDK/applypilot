import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('job status dropdown options stay readable when the closed select is styled as Night Flight',()=>{
  const css=readFileSync(new URL('../globals.css',import.meta.url),'utf8')
  assert.match(css,/\.jobStatusSelect option\{[^}]*background:#12171c;[^}]*color:#d9dfe6/i)
})

test('Night Flight closed-select styling remains isolated in the presentation wrapper',()=>{
  const page=readFileSync(new URL('../page.js',import.meta.url),'utf8')
  assert.match(page,/NIGHT_FLIGHT_STATUS_STYLE/)
  assert.match(page,/style:\{\.\.\.\(select\.props\.style\|\|\{\}\),\.\.\.NIGHT_FLIGHT_STATUS_STYLE\}/)
})
