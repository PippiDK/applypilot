import test from 'node:test'
import assert from 'node:assert/strict'
import { extractJobindexExternalDetail } from './jobindex-parser.js'

const body='Lead complex enterprise project delivery across scope, risks, dependencies, vendors and senior stakeholders. '.repeat(12)

test('extracts HR-manager AdvertisementInnerContent without surrounding form noise',()=>{
  const html=`<html><body>
    <div id="AdvertisementContent"><div id="AdvertisementInnerContent"><p>${body}</p></div></div>
    <div id="ApplicationForm">Application form noise that must not be part of the job description.</div>
  </body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://candidate.hr-manager.net/ApplicationInit.aspx?cid=1716&ProjectId=144227'})
  assert.ok(detail.fullJd.length>700)
  assert.match(detail.fullJd,/enterprise project delivery/i)
  assert.doesNotMatch(detail.fullJd,/Application form noise/i)
})

test('extracts HR-ON job description without application form content',()=>{
  const html=`<html><body>
    <div class="job-post"><div class="description"><p>${body}</p></div><div class="application">Application form noise that must not be part of the job description.</div></div>
  </body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://copenhagengroup.hr-on.com/show-job/343576'})
  assert.ok(detail.fullJd.length>700)
  assert.match(detail.fullJd,/enterprise project delivery/i)
  assert.doesNotMatch(detail.fullJd,/Application form noise/i)
})

test('extracts Pharmacosmos structured job text without footer noise',()=>{
  const html=`<html><body>
    <div class="structured-text"><p>${body}</p></div>
    <footer>Footer noise that must not be part of the job description.</footer>
  </body></html>`
  const detail=extractJobindexExternalDetail(html,{url:'https://pharmacosmos.com/career/job-openings/project-manager-for-strategic-projects'})
  assert.ok(detail.fullJd.length>700)
  assert.match(detail.fullJd,/enterprise project delivery/i)
  assert.doesNotMatch(detail.fullJd,/Footer noise/i)
})
