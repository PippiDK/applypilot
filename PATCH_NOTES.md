# ApplyPilot — Expertise Match Semantic Evaluator Patch

Target branch: `ui-redesign`

## Scope

This patch changes only the right-side Expertise Match pipeline.
It does **not** contain or modify LinkedIn search, live-match ranking, left-panel scoring, or UI files.

## Production changes

- `app/lib/expertise-service.js` — changes the flow to:
  1. extract structured JD requirements;
  2. ask AI to evaluate those requirements semantically against the full Source CV;
  3. calculate the final percentage deterministically.
- `app/lib/expertise-evaluator.js` — new semantic evaluator with four statuses:
  - `MATCHED`
  - `TRANSFERABLE`
  - `PARTIAL`
  - `NOT_EVIDENCED`
- `app/lib/expertise-semantic-score.js` — new deterministic scoring layer:
  - MATCHED = 1.00
  - TRANSFERABLE = 0.75
  - PARTIAL = 0.40
  - NOT_EVIDENCED = 0.00
  - existing importance weights remain critical/core/supporting = 3/2/1.

## Safety rules

- Semantic equivalence is allowed; exact keyword identity is not required.
- OR requirements are satisfied by one directly evidenced alternative.
- Compound requirements preserve partial credit when only some components are evidenced.
- Generic leadership/delivery is not erased by a missing AI/M&A/domain qualifier.
- Specialist domain experience is not invented or over-credited.
- AI must return verbatim Source CV excerpts for every non-zero judgement.
- Any invented/paraphrased evidence that is not found in Source CV is rejected.
- Final percentages remain deterministic code, not model-generated numbers.

## Tests included

- `expertise-evaluator.test.mjs`
- `expertise-semantic-score.test.mjs`
- replacement `expertise-service.test.mjs`

Local targeted regression result before packaging: 5 tests passed, 0 failed.

## Files intentionally NOT included

No files under `app/api/linkedin-search`, no LinkedIn search libraries, no left-panel UI, no `page.js`, and no CSS files.
