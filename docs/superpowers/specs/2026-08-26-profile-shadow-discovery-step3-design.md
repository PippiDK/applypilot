# Profile-Driven Shadow Discovery — Step 3 Design

Date: 2026-08-26
Status: Approved in chat for implementation
Branch: `feature/cv-library-3-slots`
Baseline TEST head before Step 3: `749e4ca4909ec5827ee97366ae711ee0b44c134c`

## Goal

Run the saved Union Search Plan as a lightweight, profile-driven LinkedIn discovery path in parallel with the existing production Search, without changing legacy discovery, Full-JD reading, gates, scoring, ranking, Live Matches, or production Search Audit semantics.

Step 3 answers one question: which jobs are discovered by the user-approved role directions that the current fixed discovery queries did not discover?

## Safety principle

Legacy Search remains authoritative. Shadow discovery is observational only.

A shadow failure must never make legacy Search fail, change legacy jobs, change legacy scores, or change the legacy request payload.

The following production core files are frozen for Step 3 and must remain unchanged:

- `app/lib/linkedin-search.js`
- `app/lib/linkedin-stable-search.js`
- `app/lib/linkedin-role-gate.js`
- `app/api/linkedin-search/route.js`

## Architecture

The existing Search button starts two independent requests:

1. Legacy `/api/linkedin-search` with the unchanged payload `{ freshnessDays, cvText: cvData.cvText }`.
2. Shadow `/api/linkedin-shadow-search` with `{ freshnessDays, unionSearchPlan: profile.unionSearchPlan }` when a saved non-empty Union Search Plan exists.

The shadow endpoint uses the same authenticated session and stable public LinkedIn fetcher, but it does not call the legacy search engine.

For each approved Union Search Plan direction, shadow discovery issues exactly one LinkedIn public search-page request with:

- `keywords=<direction.role>`
- `location=Denmark`
- `f_TPR=r<freshnessDays * 86400>`
- `sortBy=DD`
- `start=0`

This intentionally avoids repeated stabilization passes and deep pagination. With 15 approved directions the probe performs 15 search requests, not roughly 120 additional requests.

## Shadow discovery contract

Create `app/lib/linkedin-shadow-discovery.js` exporting:

```js
searchLinkedInShadow({ freshnessDays, unionSearchPlan, fetcher })
```

The function:

- accepts only directions with non-empty `role` values;
- preserves all approved directions; no artificial role-count cap is introduced;
- executes with bounded concurrency;
- parses only LinkedIn search cards via the existing `parseSearchHtml` parser;
- never requests job detail pages;
- deduplicates rows by LinkedIn job ID;
- records every Union Search Plan direction that found each job;
- preserves direction tier, origin, and CV slot provenance;
- tolerates partial per-direction failures;
- throws only when every attempted direction request fails;
- returns an empty valid result for an empty plan.

Result shape:

```json
{
  "candidates": [
    {
      "jobId": "1234567890",
      "title": "Integration Programme Manager",
      "company": "Example",
      "location": "Copenhagen",
      "publishedAt": "2026-08-26",
      "url": "https://www.linkedin.com/jobs/view/1234567890/",
      "foundBy": [
        {
          "key": "integration project manager",
          "role": "Integration Project Manager",
          "tier": "primary",
          "origin": "cv",
          "cvSlots": [1, 3]
        }
      ]
    }
  ],
  "stats": {
    "directions": 15,
    "primaryDirections": 7,
    "adjacentDirections": 8,
    "searchRequests": 15,
    "searchFailures": 0,
    "searchRows": 100,
    "discovered": 80
  },
  "coverage": {
    "status": "SEARCHED",
    "detail": null
  }
}
```

## Legacy comparison

Create a pure helper `app/lib/shadow-search-compare.js`.

The legacy `data.audit` contains one record for every unique job discovered by the existing legacy discovery before later gates. Therefore comparison must use legacy audit job IDs, not only Live Matches.

`compareShadowToLegacy({ candidates, legacyAudit })` returns:

- total shadow candidates;
- count already discovered by legacy;
- count genuinely new to discovery;
- new candidates themselves;
- count of new candidates reached by at least one Primary direction;
- count reached only by Adjacent directions.

Primary wins for category counting when one new candidate was found by both Primary and Adjacent directions, so `newFromPrimary + newFromAdjacent = newCandidates`.

## API route

Create `app/api/linkedin-shadow-search/route.js`.

Requirements:

- `requireUser()` authentication, identical security boundary to legacy Search;
- validate freshness to `[1,3,7,14]`, default 7;
- accept only the supplied saved Union Search Plan snapshot;
- construct `createLinkedInStableFetcher()`;
- call only `searchLinkedInShadow`;
- return `fetchedAt`;
- return HTTP 502 on operational shadow failure;
- never import or call `searchLinkedInStable`.

## UI and state

Create `app/components/shadow-search-audit.js`.

It is a diagnostic details panel placed beside/below existing Search Audit. It must be visibly labeled as shadow-only and state that it has no effect on Live Matches.

Show:

- directions searched;
- Primary / Adjacent counts;
- shadow candidates discovered;
- already discovered by legacy;
- genuinely new candidates;
- Primary vs Adjacent-only new counts;
- each new candidate with title, company, and `FOUND BY` role labels plus CV provenance when available;
- partial-access/error information if shadow had failures.

The panel must not merge shadow rows into `jobs`, `state.audit`, scoring, or selected-job flows.

## Client wiring

`app/page.js` adds independent `shadowState`.

When Search starts:

- clear the previous shadow state;
- start legacy and shadow requests in parallel when a saved plan exists;
- keep the legacy request body byte-for-byte behaviorally equivalent to Step 2;
- legacy success updates `jobs` and existing `state` exactly as before;
- shadow success is compared against the just-returned legacy `data.audit` and updates only `shadowState`;
- shadow failure records only a shadow diagnostic error;
- if no saved plan exists, shadow is skipped silently and legacy Search behaves exactly as before.

## Explicitly out of scope

- No replacement of `DISCOVERY_QUERIES`.
- No role synonym expansion.
- No AI-generated queries.
- No Full-JD fetch for shadow candidates.
- No role gate, hard exclusion, scoring, expertise match, Best CV, or ranking for shadow candidates.
- No promotion of shadow-only candidates into Live Matches.
- No changes to profile role generation or Union Search Plan compilation.
- No changes to `main`.

## TDD acceptance cases

1. One and only one search-page request is issued per approved role direction.
2. Shadow request uses exact approved role text, Denmark, selected freshness, DD sort, and `start=0`.
3. No job-detail URL is requested.
4. Duplicate jobs discovered by multiple directions are emitted once with aggregated `foundBy` provenance.
5. Primary/Adjacent, origin, and CV slot provenance are preserved.
6. A failed direction does not discard successful directions.
7. All attempted direction failures produce an operational error.
8. Empty plan returns an empty valid result without network calls.
9. Comparison uses legacy audit IDs, not only legacy returned jobs.
10. New candidate counts partition into Primary and Adjacent-only without double counting.
11. Shadow API requires auth and does not invoke legacy search engine.
12. Page wiring sends the legacy payload unchanged.
13. Page wiring sends only the saved `profile.unionSearchPlan` to shadow.
14. Shadow failure cannot enter legacy error state or alter legacy jobs.
15. Shadow diagnostic UI is explicitly labeled as non-authoritative.
16. Frozen production Search core files remain unchanged from Step 2 baseline.
17. Step 1 + Step 2 + Step 3 tests pass and production build passes.
18. `main` remains at `354c799c8ffe31e599f175ae4770ae4086a73a91` during Step 3.

## Definition of done

Step 3 is complete when the saved Union Search Plan can perform lightweight profile-driven discovery in parallel with legacy Search, produce a diagnostic delta against legacy discovery, surface that delta only in a shadow audit panel, survive its own failures independently, and all frozen legacy Search behavior remains unchanged and verified.