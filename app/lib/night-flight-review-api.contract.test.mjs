import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routePath=new URL('../api/night-flight-review/route.js',import.meta.url)
const source=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):''

test('Task 11 Morning Review API keeps authenticated GET and adds authenticated POST recovery',()=>{
  assert.match(source,/export async function GET/)
  assert.match(source,/export async function POST/)
  assert.match(source,/await requireUser\(\)/)
  assert.match(source,/createServerSupabaseClient/)
  assert.match(source,/loadNightFlightMorningReview/)
  assert.match(source,/recoverFailedNightFlightMatch/)
  assert.doesNotMatch(source,/export async function PUT/)
})

test('Task 11 recovery POST accepts runId and jobKey then returns refreshed saved review',()=>{
  assert.match(source,/request\.json\(\)/)
  assert.match(source,/runId/)
  assert.match(source,/jobKey/)
  assert.match(source,/recoverFailedNightFlightMatch\(\{[\s\S]*userId:auth\.user\.id[\s\S]*runId[\s\S]*jobKey/)
  assert.match(source,/loadNightFlightMorningReview\(\{supabase,userId:auth\.user\.id\}\)/)
  assert.match(source,/NextResponse\.json\(\{review\}\)/)
})

test('Task 11 review route delegates Match generation to the recovery service rather than creating a second scoring path',()=>{
  assert.doesNotMatch(source,/analyzeExpertiseMatch|requestExpertiseMatch/)
})
