from pathlib import Path


def replace_once(path, old, new):
    p=Path(path)
    s=p.read_text()
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'Expected snippet not found in {path}: {old[:100]!r}')
    p.write_text(s.replace(old,new,1))

# Auth contract: direct writer is now the provider/business marker after auth.
replace_once('app/lib/auth-private-api-guard.test.mjs',
"['tailor-cv','../api/tailor-cv/route.js',['request.json','analyzeJob']]",
"['tailor-cv','../api/tailor-cv/route.js',['request.json','writeProfessionalSummary']]")

# M4 review contract: same selection/baseline/decision UI, direct AI result instead of Truth Guard result.
p='app/lib/cv-adaptation-review-ui.contract.test.mjs'
replace_once(p,"test('M4.11 page runs the real selected-CV Truth Guard pipeline before opening review',()=>{","test('M4 review runs direct selected-CV adaptation before opening review',()=>{")
replace_once(p,'assert.match(page,/requestTruthGuard/)','assert.match(page,/requestCvAdaptation/)')
replace_once(p,'assert.match(page,/safeAdaptationReviewBlocks/)','assert.match(page,/adaptationReviewBlocks/)')
replace_once(p,"test('review UI renders the three-block contract and WHY CHANGED from safe review blocks',()=>{","test('review UI renders the three-block contract and WHY CHANGED from direct AI review blocks',()=>{")

# V16 review wording now reflects direct AI output.
p='app/lib/v16-cv-review.contract.test.mjs'
replace_once(p,'assert.match(page,/requestTruthGuard/)','assert.match(page,/requestCvAdaptation/)')
replace_once(p,"test('CV Update Review keeps a focused review instead of the obsolete dashboard-style Truth Guard panel',()=>{","test('CV Update Review keeps a focused ORIGINAL UPDATED review without the obsolete Truth Guard panel',()=>{")
replace_once(p,'assert.match(page,/Truth Guard complete/)','assert.match(page,/Adaptation complete/)')
replace_once(p,'assert.match(page,/Only Truth-Guard-safe UPDATED text is shown/)','assert.match(page,/AI UPDATED text is shown directly/)')
replace_once(p,"test('legacy JD evidence accordions are absent because M4.11 reviews safe CV wording, not the JD pretest',()=>{","test('legacy JD evidence accordions are absent because M4 reviews the three adapted CV blocks, not the JD pretest',()=>{")

# JD/UI contract: explicit click remains, but it invokes direct adaptation and no evidence/truth stage.
p='app/lib/jd-analysis-ui.contract.test.mjs'
replace_once(p,"test('Adapt & review CV runs the selected-CV Truth Guard pipeline only on explicit user action',()=>{","test('Adapt & review CV runs direct selected-CV adaptation only on explicit user action',()=>{")
replace_once(p,'assert.match(source,/requestTruthGuard/)','assert.match(source,/requestCvAdaptation/)')
replace_once(p,'assert.doesNotMatch(source,/useEffect\\([^)]*requestTruthGuard/s)','assert.doesNotMatch(source,/useEffect\\([^)]*requestCvAdaptation/s)')
replace_once(p,'assert.match(source,/Truth Guard complete/)','assert.match(source,/Adaptation complete/)')
replace_once(p,"test('M4.11 review exposes all three approved CV blocks instead of Summary-only pretest UI',()=>{","test('M4 review exposes all three AI-updated CV blocks instead of Summary-only pretest UI',()=>{")
replace_once(p,'assert.match(source,/safeAdaptationReviewBlocks/)','assert.match(source,/adaptationReviewBlocks/)')
replace_once(p,"test('JD qualification detail stays inside the adaptation pipeline instead of being duplicated in review UI',()=>{","test('JD is sent with the selected CV and qualification detail is not duplicated in review UI',()=>{")
replace_once(p,'assert.match(source,/JD analysis → selected-CV evidence → three writers → Truth Guard/)','assert.match(source,/Selected CV \\+ JD → three AI updates\\./)')

# Legacy profile-review static assertions that named the removed Truth Guard layer.
p='app/lib/profile-review.test.mjs'
replace_once(p,"test('merged UI keeps Application Pack and exposes the M4.11 Truth-Guard review flow',()=>{","test('merged UI keeps Application Pack and exposes the direct M4 review flow',()=>{")
replace_once(p,'assert.match(source,/Truth Guard complete/)','assert.match(source,/Adaptation complete/)')
replace_once(p,'assert.match(source,/Only Truth-Guard-safe UPDATED text is shown/)','assert.match(source,/AI UPDATED text is shown directly/)')
replace_once(p,'assert.match(source,/Accept all safe changes/)','assert.match(source,/Accept all changes/)')
replace_once(p,"test('M4.11 CV review shows a neutral empty state when Truth Guard offers no changed safe block',()=>{","test('M4 CV review shows a neutral empty state when AI returns no changed block',()=>{")
replace_once(p,'assert.match(source,/No safe changes to review\\./)','assert.match(source,/No changes to review\\./)')
replace_once(p,"test('M4.11 UI supersedes the legacy Summary-only review with three Truth-Guard-safe blocks',()=>{","test('M4 UI supersedes the legacy Summary-only review with three direct AI blocks',()=>{")
replace_once(p,'assert.match(source,/safeAdaptationReviewBlocks/)','assert.match(source,/adaptationReviewBlocks/)')

# API contract now describes exactly the three direct writer actions.
Path('app/lib/tailor-cv-api.contract.test.mjs').write_text("""import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const route=readFileSync(new URL('../api/tailor-cv/route.js',import.meta.url),'utf8')

test('tailor-cv POST accepts selected CV plus JD and exposes only the three direct writer actions',()=>{
  assert.match(route,/write_professional_summary/)
  assert.match(route,/write_latest_role_overview/)
  assert.match(route,/write_previous_role_overview/)
  assert.match(route,/sourceVersion/)
  assert.match(route,/sourceCv/)
  assert.match(route,/job/)
  assert.doesNotMatch(route,/analyze_job/)
  assert.doesNotMatch(route,/map_selected_cv_evidence/)
  assert.doesNotMatch(route,/run_truth_guard/)
  assert.doesNotMatch(route,/tailoringToken|signTailoringToken|verifyTailoringToken/)
})

test('tailor-cv route keeps GET retired and does not log CV or JD payloads',()=>{
  assert.match(route,/export async function GET\\(\\).*status:410/s)
  assert.doesNotMatch(route,/console\\.log/)
})
""")
