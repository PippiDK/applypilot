import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const css=readFileSync(new URL('../globals.css',import.meta.url),'utf8')

test('updated CV editor visually matches original comparison box',()=>{
  assert.match(css,/\.updatedTextEditor\{[^}]*border:0[^}]*background:transparent[^}]*padding:0[^}]*margin-top:8px/s)
  assert.match(css,/\.updatedBox:focus-within/)
})
