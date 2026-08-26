# Multi-CV Search Profiles — Step 1 Design

Date: 2026-08-26
Status: Awaiting user review before implementation
Branch: `feature/cv-library-3-slots`
Baseline TEST head before this spec: `6280c4a77630576c4be3d45a3b4f20f0bccf4716`

## Goal

Replace the current `CV 1 -> Search Profile roles` assumption with a multi-CV role-profile model while keeping the existing Search UX almost unchanged and keeping the live LinkedIn Search Engine completely untouched.

This milestone answers one question only:

> Given every ready CV in the CV Library, what credible job-role directions does each CV support, and what is the deduplicated combined role proposal shown to the user?

This is the first step toward resume-driven job discovery. It is not yet connected to LinkedIn discovery, gates, scoring, Expertise Match, or Best CV.

## Product principle

Each uploaded CV is an independent career-evidence source.

Do **not** force several CVs into one averaged or consolidated profession.

If a user uploads three genuinely different CVs — for example Carpenter, Sales, and Singer — ApplyPilot must preserve all three professional directions. If three CVs are variants of the same IT-delivery career, their role proposals may naturally overlap.

Canonical model:

```text
CV Library
  CV1 -> CV Role Profile 1
  CV2 -> CV Role Profile 2
  CV3 -> CV Role Profile 3
             |
             v
     deduplicated role union
             |
             v
 existing Search Profile role-review UI
```

The CV that later helps discover a vacancy is not assumed to be the CV that should be submitted. Best CV remains a separate downstream comparison against the Full JD.

## Scope of Step 1

### In scope

- Analyse every ready CV slot, not only CV1.
- Produce an independent role proposal for each CV.
- Preserve the source relationship between a proposed role and the CV(s) that support it.
- Build a deterministic deduplicated union of all proposed Primary and Adjacent roles for the existing role-review screen.
- Keep user editing of the combined Primary / Adjacent lists.
- Cache AI output per CV sourceVersion so unchanged CVs require zero repeated AI calls.
- If only one CV is ready, behave as a one-CV system without special-case UX complexity.
- Keep existing exclusions, location/work-model steps, profile save flow, and Best CV behavior intact.

### Explicitly out of scope

- Do not connect these profiles to `linkedin-search` yet.
- Do not change `DISCOVERY_QUERIES`.
- Do not change Search role gates, hard exclusions, scoring, Search Audit, Full-JD reading, freshness, or ranking.
- Do not change Expertise Match.
- Do not change Best CV comparison logic.
- Do not modify `main`.
- Do not create a generic new Search Engine in this milestone.
- Do not merge CV text, rewrite CVs, or create a Frankenstein/master CV.
- Do not build the Union Search Plan yet; this milestone only prepares and exposes the role data needed for that next step.

## Recommended architecture

### 1. Per-CV AI role classification

Reuse the existing Search Profile role classifier semantics, but make the input explicit per CV.

For each ready Source CV, produce:

```json
{
  "cvId": "cv-2",
  "slot": 2,
  "sourceVersion": "sha256:...",
  "fileName": "...pdf",
  "primaryRoles": ["..."],
  "adjacentRoles": ["..."]
}
```

Rules remain evidence-first:

- titles must be credible from that CV alone;
- prefer professional identity and responsibility scope over industry labels;
- do not invent seniority, professions, industries, qualifications, or preferences;
- do not force older professions back into the target set when the CV clearly shows a later career direction;
- do not infer a common profession across different CVs.

A CV is classified independently. Facts from CV1 must never justify a role emitted for CV2.

### 2. Deterministic role union

After the per-CV proposals are available, combine them in code, not AI.

The union keeps two user-facing groups:

- `primaryRoles`
- `adjacentRoles`

Deduplication is case-insensitive and whitespace-normalized.

Rules:

1. A role proposed as Primary by any CV is Primary in the union.
2. An Adjacent role is included only if it is not already present as Primary.
3. Preserve stable CV-slot order for first occurrence: CV1, then CV2, then CV3.
4. Preserve source metadata internally, e.g. `Senior IT Project Manager -> [cv-1, cv-2]`.
5. Do not cap the combined list to the current per-CV 5+5 limit. Each CV may return the existing bounded proposal, but the combined user list may be larger so different career directions are not silently discarded.

This preserves the recall-first product intent without asking AI to invent a synthetic career identity.

### 3. Cache model

Current cache is keyed by one Source CV sourceVersion. Keep that useful property and make it per CV.

Each ready CV gets an independent role-profile cache entry:

```text
Search Profile role builder version + CV sourceVersion -> CV Role Profile
```

Consequences:

- Add CV3: reuse cached CV1/CV2 profiles; AI only analyses CV3.
- Replace CV2: reuse CV1/CV3; AI only analyses new CV2.
- Reopen profile with all three unchanged: 0 AI calls.
- Remove a CV: no AI call; rebuild the union deterministically from remaining cached profiles.
- `Retry/Rebuild` for a failed or explicitly refreshed CV must not unnecessarily regenerate unchanged sibling CV profiles.

No automatic AI call is triggered by typing in Primary/Adjacent textareas.

## AI-call economics

Step 1 intentionally prefers independent per-CV caching over one monolithic three-CV AI request.

For a first-time library with three ready CVs, generating role profiles may require up to three role-classification calls, one per uncached CV. This is a one-time cost for each unique CV sourceVersion.

Afterwards, unchanged profiles are reused independently. This is cheaper over normal library edits than invalidating and re-analysing all CVs whenever one slot changes.

The next Union Search Plan remains deterministic and must not require another AI call merely to combine these profiles.

## UI / UX

Keep the existing five-step Search Profile modal and existing Primary / Adjacent role textareas.

Do not add a sidebar, new navigation, or separate CV-profile screens.

Change the role step wording from the current CV1-specific language to library-aware language:

- Current concept: `Generated from CV 1`
- New concept: `Generated from 3 CVs` / `Generated from 2 CVs` / `Generated from 1 CV`

Loading copy should say that ApplyPilot is building role directions from the ready CVs rather than analysing only CV1.

The two editable lists remain the main user interaction. They show the deduplicated union so a user with Carpenter + Sales + Singer can see and edit all supported target directions on one screen.

A small non-intrusive source indication may be shown only if it helps validation, but the UX must not require the user to understand the internal per-CV architecture. No new mandatory interaction is introduced.

## Saved Search Profile compatibility

The existing saved `primaryRoles`, `adjacentRoles`, and combined `roles` remain available for backward compatibility and the existing UI.

Add multi-CV role-profile metadata separately rather than replacing those fields immediately. Suggested shape:

```json
{
  "cvRoleProfiles": [
    {
      "cvId": "cv-1",
      "slot": 1,
      "sourceVersion": "sha256:...",
      "fileName": "...",
      "primaryRoles": [],
      "adjacentRoles": []
    }
  ],
  "rolesLibraryFingerprint": "...",
  "rolesBuilderVersion": "..."
}
```

The combined editable role lists remain the saved user-facing proposal. The per-CV profiles preserve provenance for the later Union Search Plan.

Do not migrate Search itself to consume these new fields in Step 1.

## Failure behavior

Role generation is library-aware and should degrade safely:

- One CV fails while two succeed: keep successful per-CV proposals visible and show a clear partial-generation error for the failed CV rather than deleting successful results.
- No ready CVs: existing CV upload requirement remains.
- Invalid AI response for one CV: reject that CV's generated profile only; do not fabricate roles.
- Existing cached good profiles survive a sibling-CV failure.
- Saving must not silently claim all CVs were analysed if one failed.

The user may retry the missing profile without regenerating successful unchanged profiles.

## Main / TEST isolation

All implementation remains on `feature/cv-library-3-slots`.

`main` is the protected working personal-search baseline and must remain byte-for-byte untouched by this milestone.

The current production-style PM Search is intentionally preserved as a future comparative regression oracle. Step 1 itself must not alter its behavior even in TEST.

## Expected files / boundaries

Implementation should stay concentrated around Search Profile role generation and its tests, likely including:

- `app/lib/search-profile-ai.js`
- `app/lib/search-profile-cache.js`
- `app/lib/search-profile-client.js`
- `app/api/search-profile/route.js` only if the client/server contract needs explicit CV metadata support
- a small new deterministic multi-CV role-profile/union helper if that keeps boundaries clearer
- `app/components/search-profile-roles-step.js`
- minimal `app/page.js` wiring/state changes
- Search Profile-specific tests

Search core files such as `app/lib/linkedin-search.js` and `app/lib/linkedin-stable-search.js` must not change.

## TDD acceptance cases

Before implementation logic, add failing tests for at least these behaviors:

1. Three distinct CV profiles survive independently; no consolidation into one profession.
2. Primary roles from all CVs appear in the combined Primary list.
3. Adjacent roles from all CVs appear unless promoted to Primary by another CV.
4. Duplicate roles are case/whitespace-insensitively deduplicated.
5. Source provenance records all CVs supporting a duplicate role.
6. CV1-only library preserves the existing one-CV result semantics.
7. Adding a new CV does not invalidate unchanged sibling-CV caches.
8. Replacing CV2 invalidates only CV2's role-profile cache.
9. Removing a CV requires no AI regeneration for remaining CVs.
10. Reopening an unchanged three-CV library uses cache only.
11. One-CV generation failure does not erase successful sibling profiles.
12. The role step displays library-aware wording rather than `Generated from CV 1`.
13. Search request payload and Search core remain unchanged.

## Manual acceptance test with current three CVs

Using the current TEST library:

- CV1: GENERAL IT PROJECT MANAGER
- CV2: ENTERPRISE FINANCE
- CV3: CONSULTANT

Expected behavior is not a predetermined title list. The validation question is whether all credible directions evidenced by the individual CVs survive into the combined editable proposal without invented professions.

For example, overlapping IT Project/Delivery roles should deduplicate, while genuinely differentiated Finance/regulated-enterprise and Consultant/integration positioning may contribute additional credible role directions.

Then verify the existing LinkedIn Search output has not changed, because this milestone does not yet consume the new profile data.

## Definition of done for Step 1

Step 1 is complete only when:

- every ready CV has an independent cached role profile;
- the existing role-review UI shows the deduplicated union;
- unchanged CVs do not generate repeated AI calls;
- partial failure is safe and visible;
- Search Engine behavior is unchanged;
- Search core files are unchanged;
- TEST build/tests pass apart from any explicitly documented pre-existing failures;
- `main` has not moved.

After manual review of this result, stop. Step 2 — Union Search Plan — requires a separate implementation decision and must not be bundled into Step 1.
