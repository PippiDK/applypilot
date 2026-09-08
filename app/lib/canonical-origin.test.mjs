import test from 'node:test'
import assert from 'node:assert/strict'
import {canonicalAppRedirectUrl,canonicalAuthRedirectOrigin} from './canonical-origin.js'

const LIVE_HOST='applypilot-auvraen-platform.vercel.app'
const TEST_HOST='applypilot-git-v18-night-flight-status-match-auvraen-platform.vercel.app'

test('production html navigation redirects unique deployment hosts to the canonical LIVE host without changing path or query',()=>{
  const redirect=canonicalAppRedirectUrl({
    vercelEnv:'production',
    requestUrl:'https://applypilot-abc123-auvraen-platform.vercel.app/jobs?window=5',
    method:'GET',
    accept:'text/html',
  })
  assert.equal(redirect,`https://${LIVE_HOST}/jobs?window=5`)
})

test('preview html navigation redirects unique deployment hosts to the stable TEST branch host',()=>{
  const redirect=canonicalAppRedirectUrl({
    vercelEnv:'preview',
    branchUrl:TEST_HOST,
    requestUrl:'https://applypilot-preview123-auvraen-platform.vercel.app/?q=1',
    method:'GET',
    accept:'text/html',
  })
  assert.equal(redirect,`https://${TEST_HOST}/?q=1`)
})

test('canonical hosts do not redirect and api or non-html requests are left untouched',()=>{
  assert.equal(canonicalAppRedirectUrl({vercelEnv:'production',requestUrl:`https://${LIVE_HOST}/`,method:'GET',accept:'text/html'}),null)
  assert.equal(canonicalAppRedirectUrl({vercelEnv:'production',requestUrl:'https://unique.vercel.app/api/expertise-match',method:'POST',accept:'application/json'}),null)
  assert.equal(canonicalAppRedirectUrl({vercelEnv:'preview',branchUrl:TEST_HOST,requestUrl:'https://unique.vercel.app/api/expertise-match',method:'GET',accept:'application/json'}),null)
})

test('production magic-link redirects always use the canonical LIVE origin while preview keeps the stable TEST origin',()=>{
  assert.equal(canonicalAuthRedirectOrigin({vercelEnv:'production',currentOrigin:'https://unique-prod.vercel.app'}),`https://${LIVE_HOST}`)
  assert.equal(canonicalAuthRedirectOrigin({vercelEnv:'preview',branchUrl:TEST_HOST,currentOrigin:'https://unique-preview.vercel.app'}),`https://${TEST_HOST}`)
})
