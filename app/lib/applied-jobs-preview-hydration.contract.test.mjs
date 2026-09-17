import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const layoutPath=new URL('../layout.js',import.meta.url)

test('preview does not disable Supabase applied-history hydration',()=>{
  const source=readFileSync(layoutPath,'utf8')
  assert.doesNotMatch(source,/VERCEL_ENV\s*===\s*['"]preview['"]\)\s*return\s*\[\]/)
})
