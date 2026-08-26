# ApplyPilot Backlog

Living backlog for the active TEST product. Items remain here until explicitly implemented and verified; presence in this file does **not** mean a feature is shipped.

## NEXT

### AI CV Adaptation

Build the next vacancy workflow after Best CV recommendation.

Acceptance direction:
- start with `Which CV would you like to adapt for this job?`;
- show CV1 / CV2 / CV3;
- highlight/recommend the Best CV but allow the user to choose any ready CV;
- the selected baseline CV determines the adaptation plan;
- do not merge facts across CVs unless a future design explicitly permits it;
- Truth Guard remains mandatory: no invented skills, employers, achievements or responsibilities;
- provide preview + accept/reject + save workflow.

### Persistent Job Analysis

Make repeated review of the same vacancy cheap, deterministic and auditable.

Target behavior:
- same job + same JD + same relevant CV versions + same analysis version ⇒ reuse saved analysis;
- restore Best CV and Expertise Match after reload/repeated Search without another AI call;
- invalidate when JD, relevant CV content/version or analysis algorithm version changes;
- show saved-analysis state/date for auditability.

Current gap to resolve deliberately:
- Best CV cache already fingerprints job + JD + candidate-library source versions;
- Expertise Match cache currently keys more narrowly and needs JD-aware invalidation before it can be trusted as a unified persistent analysis;
- `job-analysis-cache.js` exists, but end-to-end persistence semantics across all analysis panels still need one coherent design and manual reload verification.

## PLANNED

### Multi-source sourcing — Jobindex first

Add Jobindex as the first second sourcing engine after the core personalization/persistence loop is stable.

Architecture rule:
- each source owns only its own discovery/detail parsing adapter;
- LinkedIn, Jobindex and future sources normalize into one canonical Job model;
- common role gates, Full JD evaluation, scoring, Live Matches and Audit Log remain source-agnostic;
- a parser/HTML change in one source must not break the other source or the common evaluation core.

Jobindex implementation direction:
- build a dedicated Jobindex discovery + detail/JD adapter;
- preserve a stable Jobindex `sourceJobId`, posting metadata, application URL and source provenance where available;
- use Persistent Job Memory so a republished/re-surfaced listing with the same stable identity is `SEEN` / `UPDATED`, not a false `NEW` vacancy;
- deduplicate the same vacancy found on LinkedIn and Jobindex using stable source identities plus a canonical vacancy fingerprint, not title/company text alone;
- expose per-source coverage/parser-health diagnostics so Audit can distinguish source failure from common evaluation decisions;
- after Jobindex is proven stable, evaluate whether IT-Jobbank can reuse the same adapter family.

### Vacancy filtering and sorting — after UX evidence

Do not add controls just because they are conventional. Observe real usage first.

Candidate first controls:
- Filter: `All · Unreviewed · Considering · Applied · Ignore`
- Sort: `Newest · Relevance · Status`

### Search-direction normalization

Normalize semantically equivalent role directions before profile-driven discovery, including UK/US spelling variants such as `Programme` / `Program`, while preserving provenance and Primary-over-Adjacent precedence.

### Explicit Preview gate

When the next manual-testable milestone is ready, introduce/use a dedicated branch such as `preview/applypilot-test`. Keep normal development commits on `feature/cv-library-3-slots` non-deploying; update the Preview branch only after tests/regression/build are green.

### Analysis audit/history UX

Once Persistent Job Analysis exists, expose enough metadata to answer: which JD/CV versions produced this result, when it was saved, and whether it was reused or regenerated.

## UX OBSERVATION

### Manual vacancy statuses

Observe for several real search cycles before designing filters/sorting:
- which status is used most;
- whether `Ignore` should be hidden by default or merely de-emphasized;
- whether `Applied` should remain in normal results;
- whether status counts are useful;
- whether sort-by-status is actually wanted.

Implementation persists statuses in localStorage by job ID. Repeated-Search behavior has been manually exercised; a clean explicit F5/browser-restart persistence check should still be recorded before calling the full UX path verified.

### Search Profile direction summary

The header now derives `N search directions · X primary · Y adjacent` from saved `unionSearchPlan`. Observe whether users need to see actual top role names in the compact header or only counts.

### Best CV vs Expertise Match mental model

Keep observing whether users understand the separation:
- Expertise Match = candidate/job professional fit;
- Best CV = which existing document presents that candidate best for this JD;
- future Adaptation = how to tune the chosen document truthfully.

## TECH DEBT

### Runtime / dependency baseline

- Add a dependency lockfile so CI and local installs resolve reproducibly.
- Move CI/runtime baseline to Node **22+** before upgrading related packages; current Supabase packages warn that Node 20 is below their supported engine.
- Upgrade Next.js from `14.2.15` to a currently patched supported release after a dedicated compatibility/security pass. Do not combine this with unrelated feature work.

### Legacy/root repository audit

Prove usage before deleting any historical material. Audit at least:
- legacy Python modules under `app/` and `tests/`;
- old source adapters under `app/sources/`;
- root-level `page.js`, `layout.js`, `globals.css`, `route.js`, `route (1).js`, `route (2).js`;
- `ApplyPilot_OnePass_Expertise_Optimization/`;
- `ApplyPilot_Semantic_Evaluator_502_Fix/`;
- historical patch notes/artifacts.

Output of the audit should classify each item as active runtime, test fixture, reference/archive, or safe-to-delete. No bulk cleanup before that classification.

### Cache architecture consolidation

Avoid accumulating independent cache semantics for Best CV, Expertise Match and job-level analysis. Persistent Job Analysis should define one explicit identity/versioning contract and migration/invalidation policy.

### Deployment verification automation

Eventually replace temporary per-milestone verifier workflows with a stable CI workflow that always runs targeted/core regression/build checks but does not cause a Vercel Preview from the development branch.
