# ApplyPilot Semantic Evaluator 502 Fix

Target branch: `ui-redesign`

This patch fixes the new semantic Expertise Match stage only.

Changed:
- `app/lib/expertise-evaluator.js`
- `app/lib/expertise-evaluator.test.mjs`

Root cause addressed:
- the old semantic output schema allowed 1-25 evaluations while post-validation required exactly one per JD requirement;
- generated evaluation IDs were unconstrained by schema;
- Truth Guard was stricter about punctuation than necessary, so verbatim words with harmless punctuation differences could be rejected;
- post-validation failures had no stable diagnostic code and surfaced as `AI_UNKNOWN`.

Not touched:
- LinkedIn search engine
- left Live Matches panel
- scoring weights
- page.js / UI layout
- globals.css
- Application Pack

Verification in isolated harness using the production `ai-client.js` contract:
- 5 tests passed
- 0 failed
