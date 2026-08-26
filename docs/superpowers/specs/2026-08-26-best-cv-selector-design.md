# Best CV Selector Design

Date: 2026-08-26
Status: Approved for TEST implementation
Branch: `feature/cv-library-3-slots`

## Goal

For one selected vacancy, compare the existing CVs in the browser-local CV Library and recommend the single strongest existing CV for that JD.

Canonical flow:

`Search -> Vacancy -> Best CV + Advice -> Use as is / Update recommended`

Expertise Match remains optional diagnostics and is not a gate for Best CV. CV Update is a later step and is not implemented by this change.

## Product rules

- MVP has exactly the existing configurable three slots: `CV 1`, `CV 2`, `CV 3` (`MAX_CVS=3`).
- Compare only ready CV slots. Missing slots are ignored explicitly; no empty/fabricated candidate is created.
- Never merge, rebuild, or assemble a CV from multiple source CVs.
- Best CV selects one existing CV only.
- Do not show a Best-CV percentage. This is a ranking/positioning decision, not a probability.
- Opening or switching vacancies never triggers Best CV AI automatically.
- One explicit `Find best CV` action may make one AI call for the full candidate set.
- Repeating the same analysis with unchanged JD and unchanged CV source versions must use cache with zero new AI calls.
- Search discovery, gates, Search Audit, ranking/scoring, Search Profile, and Expertise Match logic remain unchanged.
- `main` remains unchanged.

## Selector packets

Before the AI request, create a deterministic compact packet from each ready Source CV. Preserve recruiter-significant positioning:

- CV id / fixed slot / sourceVersion / filename metadata;
- top-of-CV professional identity;
- Professional Summary when safely detected;
- stored skill/capability labels;
- latest and previous role positioning and evidence;
- compact older role history for context.

Use the existing deterministic CV structure parser where possible. If the structure is not safe enough to compress without losing material evidence, fall back to the complete parsed CV text for that candidate rather than silently dropping evidence. Packet construction itself uses no AI.

## One-call AI comparison

One structured AI request receives:

- vacancy title, company, location, and Full JD;
- all available selector packets (or full-text fallback packets).

The evaluator judges recruiter-style positioning: top identity, summary emphasis, prominence and recency of relevant evidence, domain framing, delivery/governance/consulting positioning, regulated/financial positioning where relevant, and likely hiring-manager interpretation.

It must not invent experience, combine facts across CVs, or choose by keyword count alone.

## Structured result

Return:

```json
{
  "recommendedCvId": "cv-2",
  "rankedCvIds": ["cv-2", "cv-1", "cv-3"],
  "reason": "Concise recruiter-style explanation.",
  "recommendation": "use_as_is",
  "updateFocus": []
}
```

Rules:

- `recommendedCvId` must be one of the supplied candidates.
- `rankedCvIds` contains every supplied candidate exactly once and starts with the winner.
- `recommendation` is exactly `use_as_is` or `update_recommended`.
- `updateFocus` contains at most four concise areas and is only advisory for the later CV Update feature.
- The service adds a selector version for cache/version control.

`use_as_is` means the existing winning CV is already positioned appropriately. `update_recommended` means truthful existing evidence could benefit from emphasis/order/wording changes; it must never mean fabricating missing expertise.

## Cache

Best CV cache fingerprint includes:

- job id;
- Full JD fingerprint;
- every available candidate id + sourceVersion;
- selector version.

Adding, removing, or replacing a CV, or materially changing the JD, creates a new key. Reopening the same vacancy/library state returns the cached result.

## UI

Add a compact `BEST CV FOR THIS JOB` section above Expertise Match.

Idle:
- `Not analysed`
- `Find best CV`

Analysing:
- clear loading state; no duplicate calls while loading.

Result:
- winning `CV N` and filename;
- short reason;
- compact ranked order;
- `USE AS IS` or `UPDATE RECOMMENDED`;
- optional update-focus lines;
- `Use this CV` selection action.

Selection is vacancy-specific state for downstream application work. This milestone must not silently switch or rerun the existing Expertise Match while its regression testing is ongoing.

## Error handling

- AI failure affects only Best CV; it must not remove or modify a vacancy or Search results.
- Fewer than two ready CVs degrades safely: with one ready CV, identify it as the only available CV rather than fabricate a comparison.
- Invalid AI candidate ids/rankings are rejected.
- Safe API errors must not log CV or JD text.

## Token rules

`No automatic AI repeat while source inputs are unchanged.`

- 0 AI on vacancy open/navigation.
- 1 AI call on explicit uncached Best CV analysis with two or three CVs.
- 0 AI on cache hit.
- Selector packet construction is deterministic code.

## Explicit non-goals

This change does not:

- change LinkedIn Search;
- connect Search Profile to Search;
- modify Expertise Match scoring/prompt/cache/UI;
- generate or rewrite a CV;
- implement CV Update;
- merge CVs;
- add more than three MVP slots;
- change production/main.

## Verification

Use TDD for packet construction, validation, cache invalidation/reuse, client/API contract, and manual UI behavior. Final scope diff from the pre-feature TEST head must contain only Best CV files/tests/docs plus the minimal right-panel UI/CSS wiring; no Search or Expertise files may change.