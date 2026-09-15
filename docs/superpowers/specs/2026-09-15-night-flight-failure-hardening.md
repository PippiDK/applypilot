# Night Flight Failure Hardening Specification

**Source:** `ApplyPilot_Handover_2026-09-15(2).md`, supplied by the user on 15 Sep 2026.

## Goal

Harden the Night Flight failure path without changing Expertise Match scoring or recalculating saved `READY` results. Complete development and verification locally and in GitHub before allowing one final production deployment.

## Production baseline

- Repository: `PippiDK/applypilot`
- Baseline: `main` at `782be7167f1d5a05d687fbf411e472ec193fefa4`
- Verified production badge: `LIVE 18 · 782be71`

## Required behavior

1. Persist a safe AI failure classification with the sanitized message, for example `AI_PROVIDER_HTTP_429 · expertise_match_one_pass AI stage failed.`
2. Never persist CV text, JD text, provider response bodies, API keys, or other sensitive provider details.
3. Classify network and timeout failures safely.
4. Attempt each vacancy at most once during one queue invocation.
5. Leave retryable failures in `RETRY` for a later cron invocation.
6. Move deterministic or otherwise non-retryable failures directly to `FAILED`.
7. Bound the number of jobs processed by a cron invocation so it completes before Vercel's 300-second runtime limit.
8. Keep `READY` jobs terminal and never recalculate them.
9. Preserve same-date run resume and persisted run reconciliation.
10. Render a repeated Morning Review `lastError` / `recoveryError` message only once while leaving distinct errors visible.

## Verification requirements

- Observe the new regression tests fail before production code changes.
- Run targeted tests after implementation.
- Run the complete `npm test` suite.
- Run `npm run build`.
- Inspect the complete diff for unrelated changes.
- Push one coherent feature branch and use GitHub CI as the primary remote gate.
- Merge only after CI is green.
- Permit no more than one preview deployment, and only if runtime verification cannot otherwise be completed.
- Produce one final production deployment and verify its runtime state/logs after the next Night Flight tick.

## Non-goals

- Do not change Expertise Match scoring weights, semantics, or prompts.
- Do not change Source CV content, vacancy matching, or unrelated UI.
- Do not replace or invalidate saved `READY` analyses.
- Do not change the Main Search Night Flight result-reuse fix from `782be7167f1d5a05d687fbf411e472ec193fefa4`.
