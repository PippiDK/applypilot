import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJobindexDetail } from './jobindex-parser.js'

test('Jobindex detail ignores YouTube links and keeps the actual employer application URL', () => {
  const html=`<html><head><meta content="IT Service Delivery Manager" property="og:title"></head><body>
    <div class="PaidJob-inner">
      <p><a href="https://www.youtube.com/watch?v=example">Watch company video</a></p>
      <h4><a href="https://careers.acme.example/jobs/42">IT Service Delivery Manager</a></h4>
      <p>Short Jobindex teaser only.</p>
    </div>
  </body></html>`
  const detail=extractJobindexDetail(html,{jobId:'h42'})
  assert.equal(detail.applicationUrl,'https://careers.acme.example/jobs/42')
})
