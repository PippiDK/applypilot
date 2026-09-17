import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const routePath=new URL('../api/applied-jobs/route.js',import.meta.url)
const layoutPath=new URL('../layout.js',import.meta.url)

test('Applied History uses durable Supabase storage in Vercel Preview',()=>{
  const route=readFileSync(routePath,'utf8')
  const layout=readFileSync(layoutPath,'utf8')

  assert.doesNotMatch(route,/VERCEL_ENV\s*===\s*['"]preview['"]\)\s*return\s*NextResponse\.json/)
  assert.doesNotMatch(layout,/VERCEL_ENV\s*===\s*['"]preview['"]\)\s*return\s*\[\]/)
  assert.match(route,/APPLIED_JOBS_PREVIEW_USER_ID/)
  assert.match(layout,/APPLIED_JOBS_PREVIEW_USER_ID/)
})
