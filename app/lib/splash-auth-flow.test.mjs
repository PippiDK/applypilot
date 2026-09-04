import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'

const layout=readFileSync(new URL('../layout.js',import.meta.url),'utf8')
const confirmRoute=readFileSync(new URL('../auth/confirm/route.js',import.meta.url),'utf8')

test('public auth flow is not wrapped by the splash gate',()=>{
  assert.equal(layout.includes("import SplashGate"),false)
  assert.equal(layout.includes('<SplashGate>'),false)
})

test('successful magic-link confirmation redirects to a dedicated welcome route',()=>{
  assert.equal(confirmRoute.includes("new URL('/welcome',url.origin)"),true)
  assert.equal(confirmRoute.includes("welcome.searchParams.set('next',next)"),true)
})

test('welcome route owns the splash and START sends the user to the app destination',()=>{
  const welcomePath=new URL('../welcome/page.js',import.meta.url)
  assert.equal(existsSync(welcomePath),true)
  const welcome=readFileSync(welcomePath,'utf8')
  assert.equal(welcome.includes('SplashGate'),true)
  assert.equal(welcome.includes('sanitizeNextPath'),true)
  assert.equal(welcome.includes('window.location.replace(target)'),true)
})
