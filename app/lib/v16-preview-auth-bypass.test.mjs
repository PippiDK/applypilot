import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

test('preview page middleware bypasses Supabase before getUser while production auth remains',async()=>{
  const source=await readFile(new URL('./supabase/middleware.js',import.meta.url),'utf8')
  const previewIndex=source.indexOf("process.env.VERCEL_ENV==='preview'")
  const getUserIndex=source.indexOf('auth.getUser()')
  assert.ok(previewIndex>=0,'preview environment guard is missing')
  assert.ok(getUserIndex>previewIndex,'preview bypass must happen before Supabase getUser')
  assert.match(source,/NextResponse\.next\(\{request\}\)/)
  assert.match(source,/pathname='\/login'|pathname\s*=\s*'\/login'/)
})

test('preview API auth bypass returns a synthetic admin user before Supabase while production still returns 401',async()=>{
  const source=await readFile(new URL('./auth/require-user.js',import.meta.url),'utf8')
  const previewIndex=source.indexOf("process.env.VERCEL_ENV==='preview'")
  const clientIndex=source.indexOf('createServerSupabaseClient()')
  assert.ok(previewIndex>=0,'preview API auth guard is missing')
  assert.ok(clientIndex>previewIndex,'preview API bypass must happen before Supabase client creation')
  assert.match(source,/vercel-preview/)
  assert.match(source,/role\s*:\s*'admin'/)
  assert.match(source,/status\s*:\s*401/)
  assert.match(source,/Unauthorized/)
})
