import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const routePath=new URL('../api/applied-jobs/route.js',import.meta.url)

test('applied jobs API reads and writes durable storage in preview too',()=>{
  const source=readFileSync(routePath,'utf8')
  assert.doesNotMatch(source,/VERCEL_ENV\s*===\s*['"]preview['"]/)
})
