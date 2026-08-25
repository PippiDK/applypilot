import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const read = relative => readFile(new URL(relative, import.meta.url), 'utf8')

test('browser client module uses @supabase/ssr createBrowserClient', async()=>{
  const source=await read('./supabase/client.js')
  assert.match(source,/createBrowserClient/)
  assert.match(source,/getSupabaseConfig/)
})

test('server client module uses @supabase/ssr createServerClient', async()=>{
  const source=await read('./supabase/server.js')
  assert.match(source,/createServerClient/)
  assert.match(source,/next\/headers/)
  assert.match(source,/createServerCookieAdapter/)
})

test('server cookie adapter reads all cookies', async()=>{
  const {createServerCookieAdapter}=await import('./supabase/cookies.js')
  const cookieStore={getAll:()=>[{name:'a',value:'1'}],set(){}}
  assert.deepEqual(createServerCookieAdapter(cookieStore).getAll(),[{name:'a',value:'1'}])
})

test('server cookie adapter writes every refreshed cookie', async()=>{
  const {createServerCookieAdapter}=await import('./supabase/cookies.js')
  const calls=[]
  const cookieStore={getAll:()=>[],set:(...args)=>calls.push(args)}
  createServerCookieAdapter(cookieStore).setAll([
    {name:'a',value:'1',options:{httpOnly:true}},
    {name:'b',value:'2',options:{sameSite:'lax'}}
  ])
  assert.deepEqual(calls,[
    ['a','1',{httpOnly:true}],
    ['b','2',{sameSite:'lax'}]
  ])
})

test('server cookie adapter safely tolerates read-only cookie stores', async()=>{
  const {createServerCookieAdapter}=await import('./supabase/cookies.js')
  const cookieStore={getAll:()=>[],set:()=>{throw new Error('read only')}}
  assert.doesNotThrow(()=>createServerCookieAdapter(cookieStore).setAll([{name:'a',value:'1',options:{}}]))
})

test('Supabase public config uses static NEXT_PUBLIC env references for client bundling', async()=>{
  const source=await read('./supabase/config.js')
  assert.match(source,/process\.env\.NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(source,/process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(source,/env\s*=\s*process\.env/)
})

test('Supabase config keeps explicit env injection for server-side tests and callers', async()=>{
  const {getSupabaseConfig}=await import('./supabase/config.js')
  assert.deepEqual(getSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL:' https://example.supabase.co ',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:' test-key '
  }),{
    url:'https://example.supabase.co',
    publishableKey:'test-key'
  })
})
