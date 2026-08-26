# Best CV Selector + Fit UX Design

Date: 2026-08-26
Status: Approved in chat for specification; implementation not started
Branch: `feature/v16-cv-review-cache-ux-cleanup`

## 1. Goal

Add a clear post-search decision flow that helps the user choose the best existing CV for a vacancy, then evaluates that selected CV against the full JD, and only then offers optional AI-assisted CV updating.

The existing LinkedIn discovery/search pipeline remains unchanged.

## 2. Product principle

The feature must preserve this sequence:

`Search -> Select vacancy -> Find best CV -> Confirm CV -> Expertise Match -> Optional CV Update`

The system must never merge, rebuild, or assemble a new CV from multiple source CVs. It selects one existing CV profile at a time.

AI work is manual and cached. No AI call occurs merely because the user opens or navigates between vacancies.

## 3. Left-side search results

### 3.1 Sorting

Vacancies remain sorted by the existing internal fit/search score from strongest to weakest.

### 3.2 Visible fit labels

Do not display the internal numeric search percentage in the vacancy list.

Show a qualitative label derived from the existing verdict instead:

- `STRONG`
- `PLAUSIBLE`
- `STRETCH`

The internal numeric score remains available to the search engine for ranking and diagnostics but is not presented as a user-facing probability or match percentage.

### 3.3 Rationale

The current left-side number is an internal search/ranking signal. Showing it next to the right-side Expertise Match percentage creates a false impression that two directly comparable percentages disagree.

## 4. Right-side vacancy flow

The right panel is ordered as follows.

### 4.1 Vacancy facts

Keep the existing vacancy header and factual cards:

- Area
- Employment Type
- Work Model

These remain factual values or `N/A`; no scores are shown in these cards.

### 4.2 Best CV for this job

Add a new section above Expertise Match.

Initial state:

- heading: `BEST CV FOR THIS JOB`
- status: `Not analysed`
- primary action: `Find best CV`
- optional secondary access: `Compare all 5 CVs`

The five logical CV profiles are:

1. DELIVERY
2. ENTERPRISE
3. CONSULTANT
4. DELIVERY · SAXO
5. ENTERPRISE · SAXO

Photo/no-photo presentation variants are not separate candidates for Best CV selection.

After analysis, show:

- one recommended CV profile
- short recruiter-style explanation of why it is the strongest positioning for this JD
- ranked alternatives in compact form
- `Use this CV` / equivalent confirmation action

Do not show a Best-CV percentage. The purpose is ranking/selection, not a pseudo-probability score.

## 5. Best CV selection logic

### 5.1 Input

One AI request receives:

- the Full JD
- all five CV profile texts
- explicit instruction to choose the strongest existing CV without combining content

### 5.2 Evaluation lens

The selector should judge recruiter-style positioning, including:

- top-of-CV professional identity
- relevance of summary emphasis
- prominence and ordering of relevant experience
- domain framing
- governance/delivery/consulting positioning
- regulated/financial positioning where relevant
- recency and prominence of evidence
- likely hiring-manager interpretation

It must not invent experience or treat a weaker narrative as stronger only because of keyword count.

### 5.3 Output

Structured output should include at minimum:

- recommended profile id
- ranked profile ids
- concise reason for the winner
- concise reason for the strongest alternative(s)
- selector version

## 6. CV confirmation and active CV state

The recommended CV is not automatically accepted.

After Best CV analysis, the user explicitly confirms which CV to use for the vacancy.

The confirmed CV becomes the vacancy-specific Active Source CV for downstream analysis.

A user may override the recommendation and choose another of the five CVs.

Changing the selected CV must update downstream state so Expertise Match and CV Update refer to the newly selected CV.

## 7. Expertise Match

Expertise Match remains a separate concept from Search Fit and Best CV selection.

It answers:

> How strongly does the selected concrete CV evidence the requirements of this concrete Full JD?

The existing visible Expertise Match percentage is retained.

The section must explicitly identify the selected CV profile, e.g.:

`Full JD <-> ENTERPRISE · SAXO`

Keep the existing sections:

- Why you fit
- Expertise gaps
- Expertise breakdown

Expertise Match remains manual and cached. Opening a vacancy does not automatically spend AI tokens.

## 8. Optional CV Update

CV Update happens only after a CV has been selected.

The interface should communicate one of two outcomes:

### 8.1 Use as is

The selected CV is already well-positioned. No AI update is required.

### 8.2 Update recommended

The system may offer a manual `Review AI Update` action.

The update may adjust only supported existing material, especially:

- Professional Summary
- emphasis/order of existing evidence
- wording in the most relevant recent roles where justified

It must not:

- invent new experience
- merge facts from different CVs into a Frankenstein CV
- remove truthful content merely to force fit
- silently mutate the original source CV

Truth Guard remains active.

## 9. Token/cost rules

### 9.1 General rule

`No automatic AI repeat while source inputs are unchanged.`

### 9.2 Best CV cache

Best CV analysis should be cached by a stable fingerprint including:

- LinkedIn job id or JD fingerprint
- versions/fingerprints of all five CV profiles
- selector version

Reopening the same vacancy with unchanged JD and unchanged CV library returns the cached result with zero new AI calls.

### 9.3 Expertise Match cache

Preserve the existing cache concept:

- vacancy/job id
- selected CV sourceVersion
- Expertise Match version

### 9.4 CV Update cache

Cache the update proposal by:

- vacancy/JD fingerprint
- selected CV sourceVersion
- updater version

## 10. CV Library storage for MVP

For the first implementation, follow the app's current browser-local CV storage pattern rather than introducing a new backend database solely for this feature.

Persist parsed CV profile data locally per browser, including:

- logical profile id/name
- original filename metadata
- parsed CV text
- sourceVersion/content fingerprint
- optional presentation-variant metadata

Do not commit CV text or PDF files to the public GitHub repository.

A later user-scoped Supabase/domain-storage migration can be treated as a separate architecture task when multi-device persistence becomes necessary.

## 11. UI states

### Best CV

- `Not analysed`
- `Analysing...`
- `Recommended`
- `Cached`
- `Error`

### Expertise Match

- existing manual idle state (`Not analysed`)
- analysing
- result
- cached result
- error

### CV Update

- unavailable until a CV is selected
- optional/use-as-is
- update recommended
- generating/review ready
- accepted / keep original

## 12. Error handling

- A Best CV AI failure must not remove the vacancy or affect Search results.
- Missing/invalid CV profiles must be shown explicitly and excluded from comparison rather than silently treated as empty text.
- If fewer than two valid CV profiles exist, Best CV comparison should degrade to a simple selected-CV flow rather than fabricate a ranking.
- If the JD changes materially, invalidate the Best CV cache for that vacancy.
- If a selected CV changes version, invalidate downstream Expertise Match/CV Update caches for that selected version only.

## 13. Search isolation

This feature must not alter:

- LinkedIn discovery queries
- discovery pagination/stabilization
- pre-detail title gates
- role gate
- Full JD retrieval logic
- Search Audit behavior
- existing internal ranking formula

The only search-list presentation change is replacing visible numeric percentages with qualitative fit labels while preserving score-based sorting.

## 14. Testing strategy

Use TDD for implementation.

Minimum coverage:

1. search list still sorts by existing internal score
2. numeric search percentage is not rendered in the normal vacancy list
3. verdict maps to STRONG / PLAUSIBLE / STRETCH correctly
4. opening a vacancy does not call Best CV AI
5. `Find best CV` calls AI once
6. cached Best CV result avoids repeat AI call
7. recommendation can be overridden by user selection
8. selected CV becomes downstream Active Source CV
9. Expertise Match cache keys include selected CV version
10. changing selected CV restores/recalculates the correct vacancy+CV analysis state
11. CV Update is unavailable until a CV is selected
12. unchanged CV Update result is reused from cache
13. missing CV profiles are handled explicitly
14. Search logic and Search Audit regression tests remain unchanged/passing
15. no CV content is committed or serialized into repository source files

## 15. Explicit non-goals

Not part of this feature:

- changing LinkedIn Search scoring
- multi-CV scoring during discovery/search
- rewriting all five CVs
- generating a master CV
- assembling one CV from multiple source CVs
- adding application tracking
- redesigning the version badge
- moving current user CV data into Supabase
- changing production/main before explicit approval

## 16. Intended user experience

The user should be able to understand the screen without comparing unrelated percentages:

1. Left list: which vacancies are strongest overall (`STRONG / PLAUSIBLE / STRETCH`), already sorted by internal fit.
2. Best CV: which existing CV should be used for this job.
3. Expertise Match: how strongly that selected CV evidences the JD, with one meaningful percentage.
4. CV Update: whether spending additional AI tokens to improve positioning is worthwhile.

This preserves the existing strong Search engine while adding the next practical application decision in a token-efficient way.
