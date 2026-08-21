# ApplyPilot Web MVP v0.4.2

Human-in-the-loop job-search autopilot for senior IT / project / delivery professionals.

## v0.4.2 — Strict Diff Review Fix

- Removes the Career Fact Bank from the user-facing interface

- Shows only **real wording changes** in Proposed CV updates
- Hides bullets that are already aligned and unchanged
- Review counters now count only actual proposed changes
- **Accept all safe changes** applies only to actual diffs
- When no wording change is needed, shows a clear **No CV wording changes needed** state
- Keeps CV evidence internally as the Truth Guard / source-of-truth layer
- Adds a user-facing **CV Update Review** summary on the dashboard
- Shows **Original → Updated** wording for every proposed CV change
- Explains **Why changed** and confirms the **Source** for each change
- Supports **Accept change** and **Keep original** decisions
- Shows a review summary with wording changes, supported role terms and unsupported-claim count
- Keeps `Why this fits` and `Gap` separate from CV-edit review
- Keeps cover-letter generation explicitly pending
- Preserves working server-side PDF/DOCX parsing from v0.3.2

## Truth rule

ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.

The current v0.4.2 rewriting layer is deliberately conservative and deterministic. It does not yet use an LLM and does not add unsupported claims.

## Current limitations

- Job cards are still demo jobs; live job-source ingestion is not connected yet.
- CV wording changes are conservative deterministic rewrites in this prototype.
- Cover letter generation is not yet enabled.
- Accepted/kept wording decisions are session UI state and are not yet persisted to a database.

## Deploy

Push all files to the connected GitHub repository. Vercel will redeploy automatically.


## v0.4.2 strict diff rule
- Proposed CV updates contains only genuine Original → Updated differences.
- Already-aligned bullets are never returned by the change builder and cannot render as review cards.
- Review counts and Accept all operate only on actual changes.
- If nothing needs changing, the review shows a single No CV wording changes needed state.
