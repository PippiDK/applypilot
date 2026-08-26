# Union Search Plan — Step 2 Design

Date: 2026-08-26
Status: Approved for implementation by user
Branch: `feature/cv-library-3-slots`
Baseline TEST head before Step 2: `d263959ca5f845ef468b071a04019948ff68d42d`

## Goal

Compile the user-reviewed multi-CV role lists into one deterministic, execution-ready Union Search Plan without changing or invoking the current LinkedIn Search Engine.

Step 1 answered: what roles do the ready CVs credibly support?

Step 2 answers: after the user edits that proposal, what exact role directions has the user approved for future search?

Canonical flow:

```text
CV1 -> CV Role Profile 1
CV2 -> CV Role Profile 2
CV3 -> CV Role Profile 3
           |
           v
Step 1 role union
           |
           v
user edits Primary / Adjacent roles
           |
           v
Step 2 Union Search Plan compiler
           |
           v
preview + saved plan
```

The current `linkedin-search` path remains unchanged and does not consume this plan yet.

## Product principle

The user's edited role lists are canonical.

AI proposals are suggestions, not hidden authority. Therefore:

- a role removed by the user must not survive in the Search Plan because it existed in raw CV role profiles;
- a role manually added by the user must appear in the Search Plan even if no CV role profile proposed it;
- moving a role between Primary and Adjacent changes its plan priority without rewriting its underlying CV provenance;
- no AI call is required to compile the plan.

This rule directly protects manual corrections such as removing an unwanted legacy role before future search.

## Scope of Step 2

### In scope

- Build a deterministic plan from the current edited `primaryRoles` and `adjacentRoles`.
- Deduplicate case/whitespace-insensitively.
- Primary wins if the same role appears in both groups.
- Preserve visible order: Primary first in user order, then Adjacent in user order.
- Attach known CV provenance from Step 1 `roleSources` / `cvRoleProfiles`.
- Mark roles with no CV provenance as `manual`.
- Keep raw CV classification support metadata separate from user-selected plan priority.
- Persist the plan with the saved Search Profile.
- Show a compact plan preview on the existing Confirm step; do not add a sixth wizard step.
- Produce a deterministic fingerprint/version for future cache/regression use.
- Add TDD coverage for manual remove/add/move and provenance behavior.

### Explicitly out of scope

- Do not call `/api/linkedin-search` with the plan.
- Do not change `DISCOVERY_QUERIES`.
- Do not change `linkedin-search.js`.
- Do not change `linkedin-stable-search.js`.
- Do not change role gates, hard exclusions, scoring, Full-JD reading, Search Audit, freshness, or ranking.
- Do not add title expansion, synonyms, capability search, or AI-generated search queries yet.
- Do not change Expertise Match or Best CV.
- Do not modify `main`.

## Plan contract

Create a small pure module, suggested path `app/lib/union-search-plan.js`.

Input:

```js
buildUnionSearchPlan({
  primaryRoles,
  adjacentRoles,
  roleSources,
  cvRoleProfiles
})
```

Output:

```json
{
  "version": "union-search-plan-v1",
  "fingerprint": "...",
  "primaryCount": 2,
  "adjacentCount": 1,
  "totalCount": 3,
  "directions": [
    {
      "key": "senior it project manager",
      "role": "Senior IT Project Manager",
      "tier": "primary",
      "origin": "cv",
      "cvIds": ["cv-1", "cv-2"],
      "cvSlots": [1, 2],
      "support": [
        {"cvId":"cv-1","kind":"primary"},
        {"cvId":"cv-2","kind":"adjacent"}
      ]
    },
    {
      "key": "execution lead",
      "role": "Execution Lead",
      "tier": "adjacent",
      "origin": "manual",
      "cvIds": [],
      "cvSlots": [],
      "support": []
    }
  ]
}
```

`origin` means only whether Step 1 provenance exists for that approved direction. It does not claim that a manual role is truthful or false; it records that the user added it rather than the CV-role classifier proposing it.

## Normalization and ordering

Normalize role identity using trimmed text, collapsed internal whitespace, and lowercase comparison keys.

Rules:

1. Deduplicate Primary internally.
2. Deduplicate Adjacent internally.
3. Remove any Adjacent duplicate already present in Primary.
4. Preserve the first user-visible spelling and order.
5. Emit all Primary directions first, then all Adjacent directions.
6. Do not cap the plan size.

## Provenance

Step 1 `roleSources` remains the authoritative provenance map for AI-proposed roles.

When an approved role matches a Step 1 source entry by normalized key:

- copy all unique `cvIds`;
- map those IDs to current CV slots using `cvRoleProfiles`;
- preserve the original support kinds (`primary` / `adjacent`) as evidence metadata;
- set `origin: "cv"`.

When no source entry matches:

- set `origin: "manual"`;
- keep empty CV/support arrays.

If the user moves a role from Adjacent to Primary, `tier` becomes `primary`, while support may still show that a CV originally proposed it as `adjacent`. This distinction is intentional.

## Fingerprint

The fingerprint is deterministic and changes when any execution-relevant plan input changes:

- plan version;
- normalized ordered role/tier list;
- provenance CV IDs and support kinds.

It must not depend on timestamps.

No AI cache is needed for Step 2 because compilation is pure code.

## UX

Keep the existing five-step Search Profile modal.

On Step 5 (`Confirm your search profile`), add a compact `SEARCH PLAN PREVIEW` block showing:

- total directions;
- Primary and Adjacent counts;
- every approved role direction;
- tier label (`PRIMARY` / `ADJACENT`);
- source label (`CV 1 · CV 2`, etc.) or `MANUAL`.

This preview is specifically for validating the future discovery input before it is connected to Search.

No new user action is required. Editing still happens in Step 2 of the existing wizard.

## Save behavior

When saving the Search Profile, persist the freshly compiled plan from the current draft, not a stale previously saved plan.

Suggested fields:

```json
{
  "unionSearchPlan": {"...":"..."},
  "unionSearchPlanVersion": "union-search-plan-v1",
  "unionSearchPlanFingerprint": "..."
}
```

The plan is a derived snapshot. Reopening the wizard may recompute the preview from the current draft at zero AI cost.

## Search isolation

The current Search function must remain byte-for-byte equivalent in behavior and continue posting only:

```js
{
  freshnessDays,
  cvText: cvData.cvText
}
```

to `/api/linkedin-search`.

The existence of `unionSearchPlan` in saved profile data must have no effect on current Search behavior.

## TDD acceptance cases

1. User-edited Primary and Adjacent roles compile into ordered plan directions.
2. Case/whitespace duplicates collapse deterministically.
3. Primary wins over Adjacent duplicates.
4. A raw CV-proposed role removed from the edited lists is absent from the plan.
5. A manually added role appears with `origin: manual` and no fake CV provenance.
6. A CV-supported role carries all supporting CV IDs/slots.
7. A role moved from Adjacent to Primary has `tier: primary` while preserving original support kind.
8. Plan fingerprint is stable for identical inputs.
9. Plan fingerprint changes when a role is added, removed, reordered, retiered, or provenance changes.
10. Empty edited lists produce an empty valid plan.
11. Confirm-step UI renders plan preview/counts and source labels.
12. Saved Search Profile contains the compiled plan snapshot.
13. Search request payload and Search core files remain unchanged.

## Definition of done for Step 2

Step 2 is complete only when:

- the edited role lists are compiled into the plan by pure deterministic code;
- manual deletion/addition is respected;
- Step 1 provenance is preserved without inventing provenance;
- the plan preview is visible on existing Step 5;
- the saved Search Profile contains the current plan snapshot;
- no additional AI call is introduced;
- current Search behavior is unchanged;
- frozen Search core files are unchanged;
- TEST tests and production build pass;
- `main` has not moved.

After manual review, stop. Step 3 — profile-driven/shadow discovery — is a separate implementation decision.