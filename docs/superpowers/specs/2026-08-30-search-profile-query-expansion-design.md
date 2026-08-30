# Search Profile Query Expansion Design

## Goal
Increase LinkedIn discovery recall without changing the Search Profile as source of truth or weakening downstream relevance filtering.

## Approved behavior
1. Search Profile approved role directions remain the only source of search intent.
2. Each approved role direction keeps its exact LinkedIn query.
3. A generic AI expansion step derives 1–3 broader but still role-related discovery queries from each approved role direction.
4. Expansion is domain-agnostic: it must work for IT, creative, healthcare, logistics, and other role families without a hard-coded profession mapping table.
5. Expanded queries are discovery-only. They do not modify the saved Search Profile, do not change tier/origin/cv provenance, and do not increase a vacancy score.
6. Exact and expanded discovery results are deduplicated by LinkedIn jobId before full-JD processing.
7. Existing full-JD verification, deterministic exclusions, freshness checks, and profileEvaluation remain authoritative for KEEP/REJECT.
8. If AI expansion fails, exact role discovery still runs and the search degrades safely rather than failing the whole search.
9. Expansion output is constrained to short job-title-style phrases, maximum 3 per source role, deduplicated case-insensitively and excluding the unchanged exact role.
10. Audit/discovery provenance must preserve whether a candidate was found by an exact or expanded query and the source Search Profile role that produced that query.

## Data flow
Search Profile unionSearchPlan directions
→ query expansion service
→ exact + expanded discovery queries
→ LinkedIn paginated discovery (existing 0/25/50/75 behavior)
→ dedupe by jobId while aggregating provenance
→ full JD verification
→ freshness
→ deterministic exclusions
→ existing profileEvaluation against the original approved Search Profile directions
→ KEEP / REJECT

## AI contract
Input: one or more approved Search Profile role titles.

Output per source role:
- sourceRole: exact approved role title
- queries: 0–3 broader discovery phrases

Guardrails:
- Preserve the occupational family and functional responsibility.
- Remove unnecessary seniority/specialization when useful for recall.
- May use common market title variants or a broader parent role.
- Must not invent unrelated occupations, industries, technologies, or qualifications.
- Must not output Boolean syntax, location/work-model terms, salary terms, or company names.
- Must not repeat the exact source role.

Examples are used only to validate generic behavior, not as hard-coded mappings:
- Senior IT Delivery Manager may broaden to IT Delivery Manager / Delivery Manager.
- Integration Project Manager may broaden to Integration Manager / Implementation Manager.
- Senior Concept Artist may broaden to Concept Artist / Digital Artist.

## Failure handling
- Expansion provider/config/rate-limit/parse failure returns no expansions and exact search continues.
- Invalid individual expansion phrases are dropped.
- An expansion failure must not change coverage to an error if exact discovery succeeds.

## Testing
Automated tests must cover:
- generic normalization, max-3 limit, duplicate/exact-role removal;
- domain independence with at least an IT role and Senior Concept Artist;
- discovery provenance for EXACT vs EXPANDED;
- dedupe when exact and expanded queries find the same jobId;
- expansion failure fallback to exact-only discovery;
- existing pagination regression remains green;
- no change to profileEvaluation semantics.

## Release constraint
Development and validation only on a non-main branch and TEST/preview deployment. main must remain unchanged until explicitly approved later.
