import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const routeUrl=new URL('../api/night-flight/settings/route.js',import.meta.url)

test('Night Flight settings route is authenticated and persists only settings fields',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/requireUser/)
  assert.match(source,/createServerSupabaseClient/)
  assert.match(source,/night_flight_settings/)
  assert.match(source,/export async function GET/)
  assert.match(source,/export async function PUT/)
  assert.match(source,/normalizeNightFlightSettings/)
  assert.match(source,/select\('enabled,sources,areas'\)/)
  assert.doesNotMatch(source,/linkedin-search|expertise-match|searchLinkedIn/)
})

test('Night Flight settings route keeps preview writes non-persistent',async()=>{
  const source=await readFile(routeUrl,'utf8')
  assert.match(source,/VERCEL_ENV==='preview'/)
  const previewIndex=source.indexOf("VERCEL_ENV==='preview'",source.indexOf('export async function PUT'))
  const upsertIndex=source.indexOf(".upsert(row,{onConflict:'user_id'})",source.indexOf('export async function PUT'))
  assert.ok(previewIndex>-1)
  assert.ok(upsertIndex>previewIndex)
})
