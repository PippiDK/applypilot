import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routePath=new URL('../api/night-flight-status/route.js',import.meta.url)
const source=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):''

test('Task 10 status API is an authenticated lightweight GET',()=>{
  assert.match(source,/export async function GET/)
  assert.match(source,/resolveNightFlightRequestContext/)
  assert.match(source,/if\(!auth\.user\) return auth\.response/)
  assert.match(source,/loadNightFlightStatus/)
  assert.match(source,/NextResponse\.json\(\{status\}\)/)
  assert.doesNotMatch(source,/analyzeExpertiseMatch|requestExpertiseMatch|getOrCreateExpertiseMatch|expertise_match_cache/)
  assert.doesNotMatch(source,/export async function POST|export async function PUT/)
})
