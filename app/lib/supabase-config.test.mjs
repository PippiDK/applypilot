import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

async function loadConfig(){
  return import('./supabase/config.js')
}

test('declares the approved Supabase auth dependencies', async()=>{
  const pkg=JSON.parse(await readFile(new URL('../../package.json',import.meta.url),'utf8'))
  assert.match(pkg.dependencies?.['@supabase/supabase-js']??'', /^\^?2\./)
  assert.match(pkg.dependencies?.['@supabase/ssr']??'', /^\^?0\./)
})

test('returns the two approved public Supabase settings', async()=>{
  const {getSupabaseConfig}=await loadConfig()
  const config=getSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'
  })
  assert.deepEqual(config,{
    url:'https://example.supabase.co',
    publishableKey:'sb_publishable_example'
  })
})

test('rejects missing Supabase URL', async()=>{
  const {getSupabaseConfig}=await loadConfig()
  assert.throws(
    ()=>getSupabaseConfig({NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'}),
    /NEXT_PUBLIC_SUPABASE_URL/
  )
})

test('rejects missing Supabase publishable key', async()=>{
  const {getSupabaseConfig}=await loadConfig()
  assert.throws(
    ()=>getSupabaseConfig({NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}),
    /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
  )
})
