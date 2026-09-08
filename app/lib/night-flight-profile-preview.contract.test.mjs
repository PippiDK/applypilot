import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const routeUrl=new URL('../api/night-flight-profile/route.js',import.meta.url)

test('Preview Night Flight profile sync uses TEST admin client instead of cookie-authenticated server client',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/createAdminSupabaseClient/)
  assert.match(source,/VERCEL_ENV\s*===\s*['"]preview['"]/)
  assert.match(source,/https:\/\/tafdswfdblxoehreaalm\.supabase\.co/)
  assert.match(source,/NEXT_PUBLIC_SUPABASE_URL\s*:\s*TEST_SUPABASE_URL/)
})
