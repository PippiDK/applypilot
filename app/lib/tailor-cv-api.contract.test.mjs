import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const route=readFileSync(new URL('../api/tailor-cv/route.js',import.meta.url),'utf8')

test('tailor-cv POST revives analyze_job without reviving legacy tailoring',()=>{
  assert.equal(route.includes("POST(){ return NextResponse.json({error:'Retired"),false)
  assert.match(route,/action\s*!==\s*['"]analyze_job['"]/)
  assert.match(route,/analyzeJob\(/)
  assert.match(route,/sourceVersion/)
  assert.match(route,/stage:'job_analyzed'/)
  assert.match(route,/token/)
})

test('tailor-cv route keeps GET retired and does not log CV or JD payloads',()=>{
  assert.match(route,/export async function GET\(\).*status:410/s)
  assert.doesNotMatch(route,/console\.log/)
})
