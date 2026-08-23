import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const form=()=>readFile(new URL('../login/login-form.js',import.meta.url),'utf8')
const page=()=>readFile(new URL('../login/page.js',import.meta.url),'utf8')

test('login is passwordless email-only UI',async()=>{
  const source=await form()
  assert.match(source,/type=\"email\"/)
  assert.doesNotMatch(source,/type=\"password\"/)
})

test('magic-link request forbids automatic user creation',async()=>{
  const source=await form()
  assert.match(source,/shouldCreateUser\s*:\s*false/)
})

test('magic-link request uses the auth confirm route on the current deployment',async()=>{
  const source=await form()
  assert.match(source,/emailRedirectTo\s*:\s*`\$\{window\.location\.origin\}\/auth\/confirm`/)
})

test('login response copy does not reveal whether email exists',async()=>{
  const source=await form()
  assert.match(source,/If this email has access/i)
  assert.doesNotMatch(source,/user not found|does not exist|unknown email/i)
})

test('login page identifies access as invite-only',async()=>assert.match(await page(),/Invite-only access/i))
