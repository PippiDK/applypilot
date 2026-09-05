import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routePath=new URL('../api/night-flight-review/route.js',import.meta.url)
const source=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):''

test('Task 9 Morning Review API is an authenticated read-only GET',()=>{
  assert.match(source,/export async function GET/)
  assert.match(source,/await requireUser\(\)/)
  assert.match(source,/createServerSupabaseClient/)
  assert.match(source,/loadNightFlightMorningReview/)
  assert.doesNotMatch(source,/export async function POST/)
  assert.doesNotMatch(source,/export async function PUT/)
})

test('Task 9 Morning Review API returns saved review data without Match generation work',()=>{
  assert.match(source,/NextResponse\.json\(\{review\}\)/)
  assert.doesNotMatch(source,/analyzeExpertiseMatch|requestExpertiseMatch|getOrCreateExpertiseMatch/)
})
