import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const routePath=new URL('../api/night-flight-settings/route.js',import.meta.url)
const source=fs.existsSync(routePath)?fs.readFileSync(routePath,'utf8'):''

test('Night Flight settings API exposes authenticated GET and PUT only',()=>{
  assert.match(source,/export async function GET/)
  assert.match(source,/export async function PUT/)
  assert.match(source,/resolveNightFlightRequestContext/)
  assert.match(source,/if\(!auth\.user\) return auth\.response/)
  assert.match(source,/loadNightFlightSettings/)
  assert.match(source,/saveNightFlightSettings/)
  assert.doesNotMatch(source,/export async function POST/)
})

test('Night Flight settings API maps validation failures to a client error',()=>{
  assert.match(source,/status:\s*400/)
  assert.match(source,/Select at least one source\./)
})
