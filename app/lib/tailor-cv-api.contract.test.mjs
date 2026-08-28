import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const route=readFileSync(new URL('../api/tailor-cv/route.js',import.meta.url),'utf8')

test('tailor-cv POST accepts selected CV plus JD through one direct adaptation action',()=>{
  assert.match(route,/adapt_cv/)
  assert.match(route,/writeCvAdaptation/)
  assert.match(route,/sourceVersion/)
  assert.match(route,/sourceCv/)
  assert.match(route,/job/)
  assert.doesNotMatch(route,/write_professional_summary/)
  assert.doesNotMatch(route,/write_latest_role_overview/)
  assert.doesNotMatch(route,/write_previous_role_overview/)
  assert.doesNotMatch(route,/analyze_job/)
  assert.doesNotMatch(route,/map_selected_cv_evidence/)
  assert.doesNotMatch(route,/run_truth_guard/)
  assert.doesNotMatch(route,/tailoringToken|signTailoringToken|verifyTailoringToken/)
})

test('tailor-cv route keeps GET retired and does not log CV or JD payloads',()=>{
  assert.match(route,/export async function GET\(\).*status:410/s)
  assert.doesNotMatch(route,/console\.log/)
})
