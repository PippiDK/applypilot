import test from 'node:test'
import assert from 'node:assert/strict'
import {stablePreviewRedirectUrl} from './preview-stable-origin.js'

test('preview page navigation redirects from unique deployment host to stable branch host',()=>{
  const redirect=stablePreviewRedirectUrl({
    vercelEnv:'preview',
    branchUrl:'applypilot-git-v18-night-flight-status-match-auvraen-platform.vercel.app',
    requestUrl:'https://applypilot-gepdch2ad-auvraen-platform.vercel.app/jobs?window=5',
    method:'GET',
    accept:'text/html,application/xhtml+xml',
  })
  assert.equal(redirect,'https://applypilot-git-v18-night-flight-status-match-auvraen-platform.vercel.app/jobs?window=5')
})

test('stable branch host does not redirect again',()=>{
  const redirect=stablePreviewRedirectUrl({
    vercelEnv:'preview',
    branchUrl:'applypilot-git-v18-night-flight-status-match-auvraen-platform.vercel.app',
    requestUrl:'https://applypilot-git-v18-night-flight-status-match-auvraen-platform.vercel.app/',
    method:'GET',
    accept:'text/html',
  })
  assert.equal(redirect,null)
})

test('production, api-style requests, and non-html requests are never redirected',()=>{
  const common={
    branchUrl:'applypilot-git-v18-night-flight-status-match-auvraen-platform.vercel.app',
    requestUrl:'https://unique-preview.vercel.app/api/expertise-match',
  }
  assert.equal(stablePreviewRedirectUrl({...common,vercelEnv:'production',method:'GET',accept:'text/html'}),null)
  assert.equal(stablePreviewRedirectUrl({...common,vercelEnv:'preview',method:'POST',accept:'application/json'}),null)
  assert.equal(stablePreviewRedirectUrl({...common,vercelEnv:'preview',method:'GET',accept:'application/json'}),null)
})
