import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isApiPath,
  isPublicPagePath,
  isStaticAssetPath,
  sanitizeNextPath,
  normalizeOtpType
} from './auth/route-policy.js'

test('API paths are delegated to route-level auth guards',()=>assert.equal(isApiPath('/api/expertise-match'),true))
test('non-API page is not classified as API',()=>assert.equal(isApiPath('/jobs'),false))
test('login is public',()=>assert.equal(isPublicPagePath('/login'),true))
test('auth confirm callback is public',()=>assert.equal(isPublicPagePath('/auth/confirm'),true))
test('root application page is private',()=>assert.equal(isPublicPagePath('/'),false))
test('Next static assets are public',()=>assert.equal(isStaticAssetPath('/_next/static/chunk.js'),true))
test('favicon is public',()=>assert.equal(isStaticAssetPath('/favicon.ico'),true))
test('safe relative next path is preserved',()=>assert.equal(sanitizeNextPath('/jobs?x=1'),'/jobs?x=1'))
test('absolute redirect is rejected',()=>assert.equal(sanitizeNextPath('https://evil.example'),'/'))
test('protocol-relative redirect is rejected',()=>assert.equal(sanitizeNextPath('//evil.example'),'/'))
test('backslash redirect is rejected',()=>assert.equal(sanitizeNextPath('/\\evil.example'),'/'))
test('email OTP type is accepted',()=>assert.equal(normalizeOtpType('email'),'email'))
test('invite OTP type is accepted',()=>assert.equal(normalizeOtpType('invite'),'invite'))
test('unsupported OTP type is rejected',()=>assert.equal(normalizeOtpType('recovery'),null))
