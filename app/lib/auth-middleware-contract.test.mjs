import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const middleware=()=>readFile(new URL('../../middleware.js',import.meta.url),'utf8')
const helper=()=>readFile(new URL('./supabase/middleware.js',import.meta.url),'utf8')

test('root middleware delegates to updateSession',async()=>{
  const source=await middleware()
  assert.match(source,/updateSession\(request\)/)
  assert.match(source,/export const config/)
})

test('middleware excludes framework static assets from matcher',async()=>{
  const source=await middleware()
  assert.match(source,/_next\/static/)
  assert.match(source,/_next\/image/)
})

test('session middleware calls Supabase getUser for protected pages',async()=>{
  const source=await helper()
  assert.match(source,/auth\.getUser\(\)/)
})

test('session middleware redirects anonymous protected pages to login',async()=>{
  const source=await helper()
  assert.match(source,/pathname='\/login'|pathname\s*=\s*'\/login'/)
  assert.match(source,/NextResponse\.redirect/)
})

test('session middleware lets API routes reach route-level 401 guard',async()=>{
  const source=await helper()
  const apiIndex=source.indexOf('isApiPath')
  const getUserIndex=source.indexOf('auth.getUser')
  assert.ok(apiIndex>=0 && getUserIndex>apiIndex)
  assert.match(source,/if\s*\(isApiPath\(pathname\)\)/)
})
