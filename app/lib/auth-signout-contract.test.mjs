import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const route=()=>readFile(new URL('../auth/signout/route.js',import.meta.url),'utf8')
const button=()=>readFile(new URL('../components/sign-out-button.js',import.meta.url),'utf8')
const layout=()=>readFile(new URL('../layout.js',import.meta.url),'utf8')

test('signout route is POST-only and calls Supabase signOut',async()=>{
  const source=await route()
  assert.match(source,/export async function POST/)
  assert.match(source,/auth\.signOut\(\)/)
  assert.doesNotMatch(source,/export async function GET/)
})

test('signout route redirects to login after clearing session',async()=>{
  const source=await route()
  assert.match(source,/\/login/)
  assert.match(source,/303/)
})

test('root layout includes compact sign-out control without modifying Home page',async()=>{
  assert.match(await layout(),/SignOutButton/)
  assert.match(await button(),/method="post"/)
  assert.match(await button(),/\/auth\/signout/)
})
