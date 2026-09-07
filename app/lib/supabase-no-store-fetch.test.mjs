import test from 'node:test'
import assert from 'node:assert/strict'
import {createNoStoreFetch} from './supabase/no-store-fetch.js'

test('backend Supabase fetch always opts out of Next.js data cache',async()=>{
  const calls=[]
  const baseFetch=async(input,init)=>{
    calls.push({input,init})
    return {ok:true}
  }
  const noStoreFetch=createNoStoreFetch(baseFetch)

  await noStoreFetch('https://example.supabase.co/rest/v1/night_flight_jobs',{
    method:'GET',
    headers:{accept:'application/json'},
    cache:'force-cache',
  })

  assert.equal(calls.length,1)
  assert.equal(calls[0].input,'https://example.supabase.co/rest/v1/night_flight_jobs')
  assert.equal(calls[0].init.method,'GET')
  assert.deepEqual(calls[0].init.headers,{accept:'application/json'})
  assert.equal(calls[0].init.cache,'no-store')
})

test('backend Supabase fetch supports missing init while forcing no-store',async()=>{
  let captured
  const noStoreFetch=createNoStoreFetch(async(_input,init)=>{
    captured=init
    return {ok:true}
  })

  await noStoreFetch('https://example.supabase.co/rest/v1/night_flight_runs')
  assert.equal(captured.cache,'no-store')
})

test('admin Supabase client wires the no-store fetch into supabase-js',async()=>{
  const {readFile}=await import('node:fs/promises')
  const source=await readFile(new URL('./supabase/admin.js',import.meta.url),'utf8')
  assert.match(source,/createNoStoreFetch/)
  assert.match(source,/global\s*:\s*\{\s*fetch/)
})
