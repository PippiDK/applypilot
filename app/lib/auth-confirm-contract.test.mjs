import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const source=()=>readFile(new URL('../auth/confirm/route.js',import.meta.url),'utf8')

test('confirmation route reads token_hash',async()=>assert.match(await source(),/searchParams\.get\('token_hash'\)/))
test('confirmation route validates OTP type',async()=>assert.match(await source(),/normalizeOtpType/))
test('confirmation route verifies token hash with Supabase',async()=>assert.match(await source(),/auth\.verifyOtp\(\{token_hash,type\}\)/))
test('confirmation route uses safe local next redirect',async()=>assert.match(await source(),/sanitizeNextPath/))
test('confirmation route sends invalid links back to login safely',async()=>assert.match(await source(),/invalid_or_expired_link|invalid_link/))
test('confirmation route does not echo provider error messages',async()=>assert.doesNotMatch(await source(),/error\.message/))
