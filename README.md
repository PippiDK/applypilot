# ApplyPilot

ApplyPilot is a focused job-search assistant for senior IT project, delivery and transformation roles. The current product is a **Next.js 14 / React 18** application deployed through Vercel and backed by public LinkedIn discovery plus AI-assisted CV/job analysis.

## Current product

### LinkedIn public search

The production search path discovers public LinkedIn vacancies, reads public job detail pages/full JDs where available, evaluates them and returns worthwhile Live Matches.

The current legacy LinkedIn Search core is deliberately frozen while the new profile-driven search architecture is developed around it. Shadow Search is diagnostic only and must not change Live Matches, ranking or scores.

### CV Library and Search Profile

- Up to **3 CVs** can be prepared in the CV Library.
- **CV1 remains the Primary Search CV** for the frozen legacy Search/evaluation path.
- Search Profile analyses all ready CVs and builds editable **Primary** and **Adjacent** role directions.
- The deterministic **Union Search Plan** deduplicates directions, preserves CV provenance and stores counts/fingerprint/version data.
- Search Plan Preview shows exactly what the profile-driven search layer intends to cover.

### Shadow Search diagnostic

Profile-driven Shadow Discovery runs separately from the frozen legacy Search. It compares what approved Search Profile directions discover against the legacy discovery surface without changing user-facing results.

The technical diagnostics live at the bottom of the page under **AUDIT LOG**.

### Vacancy review workflow

Each Live Match can show:

- factual Area / Employment Type / Work Model cards near the vacancy header;
- **Expertise Match** for professional JD ↔ Source CV fit;
- **Best CV for this job** as an informational recommendation with ranking/reasons and `USE AS IS` or `UPDATE RECOMMENDED` guidance;
- manual vacancy status: **Applied / Considering / Ignore / no status**.

Manual statuses are user metadata persisted by job ID and must never affect Search, scoring, ranking or whether a vacancy remains in the list.

### Authentication

The repository contains Supabase-based login/confirmation/sign-out flows, middleware/route policy and private API guards. Preview-specific authentication behavior is covered by contract tests.

## Safety invariants

The following frozen LinkedIn Search files must not change without an explicit Search-core milestone:

- `app/lib/linkedin-search.js`
- `app/lib/linkedin-stable-search.js`
- `app/lib/linkedin-role-gate.js`
- `app/api/linkedin-search/route.js`

Additional product rules:

- Shadow Search is observational only.
- Manual vacancy status is presentation metadata only.
- CV adaptation/rephrasing must remain evidence-bound: never invent skills, employers, achievements or responsibilities.
- `main` is not updated implicitly from TEST work.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

The repository currently has no dependency lockfile; reproducible dependency installation and the Node/runtime upgrade are tracked in `docs/BACKLOG.md` rather than being changed opportunistically.

## Deployment workflow

Active development currently happens on `feature/cv-library-3-slots`.

Automatic Vercel Git deployments are disabled for that development branch in `vercel.json`. Development commits should follow:

1. implement a bounded change;
2. run targeted tests;
3. run full regression;
4. run production build;
5. expose **one** Preview only when a milestone is ready for manual UX testing.

A dedicated branch such as `preview/applypilot-test` is reserved as the future explicit Preview gate; it should be updated only when a manual-testable milestone is ready.

## Documentation

- Living backlog: `docs/BACKLOG.md`
- Delivery history: `docs/CHANGELOG.md`
- Detailed designs: `docs/superpowers/specs/`
- Implementation plans: `docs/superpowers/plans/`

## Repository hygiene note

The repository also contains legacy Python modules, root-level duplicate/patch artifacts and historical patch directories. They are **not being deleted by assumption**. Their runtime/use status must be proven in a dedicated technical-debt audit before removal.
