import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const layoutUrl=new URL('../layout.js',import.meta.url)
const loaderUrl=new URL('../loader.css',import.meta.url)

test('root layout loads the shared ApplyPilot spinner styles',async()=>{
  const source=await readFile(layoutUrl,'utf8')
  assert.match(source,/import '\.\/loader\.css'/)
})

test('LinkedIn loading state reuses the double mint spinner in Live matches',async()=>{
  const css=await readFile(loaderUrl,'utf8')
  assert.match(css,/main:has\(\.controls \.primary:disabled\) \.list \.empty/)
  assert.match(css,/orbitSpin 1\.05s linear infinite/)
  assert.match(css,/orbitSpinReverse \.72s linear infinite/)
})
