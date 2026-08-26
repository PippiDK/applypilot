# ApplyPilot Changelog

This file records meaningful product, bug-fix, verification and maintenance milestones. Historical design/spec documents remain under `docs/superpowers/`.

## 2026-08-27

### Maintenance

- Added a branch-specific Vercel deployment guard: ordinary commits to `feature/cv-library-3-slots` no longer auto-create Preview deployments.
- Added maintenance design/spec and implementation plan for bounded cleanup with frozen Search-core constraints.
- Removed obsolete Best CV **user-selection persistence** after the Best CV panel became informational-only. The Best CV analysis cache itself remains intact.
- Added a contract test proving the obsolete `readBestCvSelection` / `writeBestCvSelection` exports are gone while analysis-cache behavior remains covered.
- Replaced the obsolete single-milestone README with current product architecture, invariants, development and deployment workflow documentation.
- Added this living changelog and `docs/BACKLOG.md`.
- Recorded dependency/runtime findings as technical debt instead of mixing security/runtime upgrades into this maintenance pass: no lockfile, Node-engine mismatch warnings for current Supabase packages, and an outdated Next.js security baseline.
- Explicitly deferred uncertain legacy/root-file deletion to a dedicated usage audit.

## 2026-08-26

### Features — Multi-CV Search architecture

- Added **CV Library with up to 3 CV slots** while retaining CV1 as the Primary Search CV for the frozen legacy Search/evaluation path.
- Added Multi-CV Search Profile role generation across all ready CVs, with editable **Primary** and **Adjacent** role directions and CV provenance.
- Added deterministic **Union Search Plan** compilation with deduplication, Primary precedence, provenance, manual-vs-CV origin, counts, fingerprint and version metadata.
- Added Search Plan Preview to show approved search directions before later search-engine integration.
- Added **Profile-driven Shadow Discovery** as an isolated diagnostic: one bounded public LinkedIn discovery request per approved direction, comparison against the legacy audit surface, and no effect on Live Matches, scoring, ranking or legacy Search output.

### Features — vacancy review UX

- Changed **Best CV for this job** to an informational recommendation only. Removed the `Use this CV` / selected-state UX so document choice belongs to the future CV Adaptation workflow.
- Added manual vacancy statuses: **Applied / Considering / Ignore / no status**, stored by job ID. Status is user metadata only and never filters or changes Search/ranking/scoring logic.
- Moved factual **Area / Employment Type / Work Model** cards upward under the vacancy title/company/location area so job conditions are visible before deeper analysis.

### UX / bug fixes

- Clarified Search Profile Step 5 by renaming the ambiguous `CV` row to **Primary Search CV**, making the distinction between CV1 and `3/3 CVs analysed` explicit.
- Replaced the stale/hard-coded profile-strip text with a **dynamic Union Search Plan summary** (`N search directions · X primary · Y adjacent`) derived from the saved plan rather than hardcoded counts.
- Moved Search Audit and Shadow Search diagnostics out of the main decision flow into a bottom **AUDIT LOG** section and restyled them as lower-prominence technical diagnostics.
- Fixed the TEST Preview deployment mismatch that had left manual testing on an older commit; deployed the intended status/UI milestone and verified the served commit/version.

### Verification / engineering tasks

- Added/updated contract tests for informational Best CV behavior, manual job statuses, vacancy fact-card placement and cosmetic Search Profile/Audit Log changes.
- Used RED/GREEN TDD for bounded UI/behavior milestones.
- Repeatedly ran full `npm test` and production `npm run build` verification before declaring milestones complete.
- Added explicit checks that the frozen LinkedIn Search core remained byte-identical and `main` remained untouched during TEST-branch work.
- Diagnosed Vercel Preview spam caused by Git-connected development commits and established the follow-up deployment-hygiene maintenance task completed on 2026-08-27.
