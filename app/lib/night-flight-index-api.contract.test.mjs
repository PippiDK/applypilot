import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routePath=new URL('../api/night-flight-index/route.js',import.meta.url)
const source=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):''

test('Night Flight index API is authenticated read-only GET',()=>{
  assert.match(source,/export async function GET/)
  assert.match(source,/resolveNightFlightRequestContext/)
  assert.match(source,/if\(!auth\.user\) return auth\.response/)
  assert.match(source,/loadNightFlightIndex/)
  assert.doesNotMatch(source,/export async function (POST|PUT|PATCH|DELETE)/)
})

test('Night Flight index API returns only the current user index',()=>{
  assert.match(source,/loadNightFlightIndex\(\{supabase,userId:auth\.user\.id\}\)/)
  assert.match(source,/NextResponse\.json\(index\)/)
})
