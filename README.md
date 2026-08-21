# ApplyPilot Web v0.6.1 — Vacancy Link UX Fix

This release keeps the v0.6 live search engine unchanged and makes one focused UX correction: the job-detail panel links directly to the original vacancy instead of offering JD editing there.

## v0.6.1 change
- Replaced `View / edit job description` in the job-detail panel with `View vacancy ↗`, linking to the original source URL in a new tab.
- JD editing remains available only inside the CV-tailoring review flow when needed.
- No search, scoring, filtering, CV parsing, or AI-tailoring logic was changed.

## Live sources
- Jobnet (Denmark, Capital Region searches via Jobnet's public website BFF)
- Jobicy (remote jobs)
- Remotive (remote jobs; source attribution and original link preserved)

## Search Profile fields that now affect results
- Target roles and common project/delivery title variants
- Geography (Denmark / Remote EU-EMEA / worldwide)
- Preferred Denmark locations (used for ranking inside the Capital Region)
- Freshness (1, 3, 7, or 14 days; default 7)
- Salary floor when a comparable DKK salary is actually stated
- Hard exclusions, including mandatory Danish, coordinator/assistant, construction, and industrial hardware/manufacturing R&D patterns

## Search pipeline
1. Query live sources
2. Normalize vacancy data and full JD when available
3. Remove stale vacancies
4. Deduplicate
5. Reject hard no-go matches
6. Score remaining jobs against the Search Profile
7. Blend Search Profile fit with CV/JD evidence match when a CV is available
8. Show only surviving live vacancies — no fake/demo fallback

## Honest limitations
- LinkedIn, Jobindex, The Hub, Glassdoor and company-career-page adapters are not connected yet.
- Salary is only a hard filter when the source provides a comparable DKK amount; otherwise it is shown as unknown.
- AI CV tailoring remains behind the existing Vercel AI Gateway route and currently requires Gateway billing verification. This release does not change that subsystem.
- Search matching is deterministic, not LLM-based. The purpose of v0.6 is to make the Search Profile actually control retrieval and filtering before further AI work.
