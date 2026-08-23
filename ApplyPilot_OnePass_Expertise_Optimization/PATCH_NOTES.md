# ApplyPilot — One-pass Expertise Match optimization

## Purpose
Replace the active two-step AI pipeline:

JD -> requirement extraction AI -> semantic CV evaluation AI -> deterministic score

with one AI call:

Full JD + Source CV -> grounded semantic professional evaluation -> deterministic score

## Upload these files to `ui-redesign`
Preserve the paths exactly:

- `app/lib/expertise-one-pass.js` (new)
- `app/lib/expertise-one-pass.test.mjs` (new)
- `app/lib/expertise-service.js` (replace existing)
- `app/lib/expertise-service.test.mjs` (replace existing)

## Deliberately untouched
- LinkedIn search engine and left panel
- `app/page.js`
- CSS / animated dots
- API route contract
- deterministic scoring weights in `expertise-semantic-score.js`

The old `expertise-requirements.js` and `expertise-evaluator.js` may remain in the branch. The active service no longer calls them.

## Behaviour
- One structured AI call: `expertise_match_one_pass`
- Full JD and full Source CV are evaluated together semantically
- Explicit OR alternatives are satisfied by any accepted branch
- Generic transferable capability is not erased by a missing specialist domain
- Specialist domain experience is not invented or over-credited
- JD requirements require exact grounded JD evidence
- MATCHED / TRANSFERABLE / PARTIAL require grounded Source CV evidence
- Final percentage remains deterministic: MATCHED 1.0, TRANSFERABLE 0.75, PARTIAL 0.4, NOT_EVIDENCED 0
- Output budget reduced to 6000 tokens (from two stages at up to 12000 each)

## Regression verification used before packaging
`node --test app/lib/*.test.mjs` in the isolated patch harness: 5 passed, 0 failed.
