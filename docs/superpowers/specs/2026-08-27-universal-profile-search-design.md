# Universal Profile Search Design

## Goal

Replace the BUG #4 profession/domain-specific eligibility logic with a universal, Search-Profile-driven search evaluator while preserving the existing reliable Search Run infrastructure.

ApplyPilot must search the roles the user explicitly approved, read every available Full JD through the existing resumable batch pipeline, understand the vacancy regardless of language, and decide relevance by comparing the actual vacancy work to the Search Profile direction that found it.

## Hard Scope Boundaries

### Geography is out of scope

Keep the existing Step 3 geography/work-model UI, stored values, and current LinkedIn discovery behavior exactly as they are. Do not add new geography logic, country expansion, distance logic, work-model filtering, geography-driven language selection, or search aliases in this change.

The current LinkedIn discovery location behavior remains unchanged for this version.

### MATCH CV AND JD is out of scope

The entire right-side MATCH CV AND JD flow is frozen. Do not modify its UI, API, prompts, CV selection, Best CV logic, Expertise Match, requirements extraction, semantic scoring, cache, Truth Guard, tailoring, or right-panel wiring.

This project ends at Live Matches.

## Source of Search Intent

The saved Search Profile is authoritative for professional search intent:

- Primary Roles
- Adjacent Roles
- user manual role edits
- explicit user exclusions

Deleted roles must not reappear. Manually added roles are full search directions. ApplyPilot must not second-guess whether a user is allowed to search a profession.

No fixed profession taxonomy may be required for a vacancy to survive search evaluation.

## Discovery

LinkedIn discovery remains role-title driven and recall-first.

For every approved Search Profile direction, run the existing LinkedIn discovery flow. Keep existing pagination, candidate deduplication, `foundBy` provenance, Search Run persistence, and resume behavior.

Discovery is not responsible for deciding whether the actual work in the JD matches the requested profession.

No new multilingual search aliases are introduced in this version.

## Search Run Infrastructure

Preserve the current Search Run architecture:

- persistent `search_runs`
- persistent `search_candidates`
- discovery batching and deep pagination
- JD batching
- checkpointing
- preview session resume
- production resume
- incomplete/unverified handling
- coverage reporting

The key capability proven by the current architecture — hundreds of discovered vacancies can be read to completion across multiple requests — must remain intact.

## Full JD Requirement

Final search relevance cannot be decided from title alone.

For every verified vacancy, evaluation uses:

- vacancy title
- Full Job Description
- the Search Profile direction(s) recorded in `candidate.foundBy`
- explicit user exclusions

## Multilingual Semantic Understanding

Remove language-specific search intelligence such as hardcoded Danish-to-English role dictionaries.

Evaluation must be language-agnostic. A vacancy written in Danish, German, French, Chinese, English, or another language is judged by meaning rather than exact shared English tokens.

Examples that must be understood as potentially equivalent professional meaning include:

- `IT Project Manager`
- `IT-projektleder`
- `IT-Projektmanager`
- `Chef de projet informatique`

The implementation may use the existing structured AI client for semantic comparison. Language handling must not be implemented as a growing translation dictionary or regex vocabulary.

## Relevance Decision

The semantic evaluator answers one question:

> Does the actual professional work described by this vacancy match one of the approved Search Profile directions that found it?

The evaluator must compare role identity, responsibilities, work object/context, and scope from the Full JD against the approved direction. It must not apply a global opinion about which profession or industry is desirable.

Examples:

- `Senior IT Project Manager` + JD about software platform modernisation, integrations, engineering teams, releases -> strong match / KEEP.
- `Senior IT Project Manager` + JD about highway construction, civil contractors, road works -> REJECT because the actual work is professionally different, not because highways are on a blacklist.
- `Concept Artist` + JD about visual development, character concepts, environment design -> KEEP.
- `Concept Artist` + `Artist Relations Manager` JD about contracts, partnerships, account management -> REJECT.

Unknown professions must work without adding new role-family code.

## Remove BUG #4 Search Intelligence

The following must no longer participate in Search eligibility:

- `TARGET_TECH`
- `NON_TARGET_PHYSICAL`
- `NON_TARGET_FUNCTIONAL`
- `EXCLUDED_SPECIALISM`
- `AMBIGUOUS DOMAIN`
- mandatory Role Family compatibility
- `other -> reject`
- hardcoded physical/functional/technology domain rules
- system-invented ERP/R&D exclusions
- hardcoded Danish role normalization used to make eligibility decisions

Any obsolete modules may be removed once no runtime imports depend on them.

## User Exclusions

Explicit user exclusions remain authoritative.

Deterministic exclusions that are already represented as structured rules continue to run before semantic relevance evaluation when they can be checked with high confidence.

Do not infer exclusions the user did not enter. If exclusions are blank, ApplyPilot must not invent ERP, R&D, construction, finance, marketing, or any other no-go domain.

Existing `semantic_review` exclusions must not silently become automatic hard rejects as part of this project.

## Semantic Evaluation Contract

Semantic comparison runs in bounded batches, not one unbounded request over the entire search result set.

Each semantic input item contains:

- `jobId`
- vacancy `title`
- full `description`
- `foundBy` directions with their stable key, role title, and tier

Each semantic output item contains:

- `jobId`
- `compatible` boolean
- `directionKey` for the best matching approved direction, or empty when rejected
- `score` from 0 to 100 for ranking
- short evidence-based `reason`

The model must be instructed to favor recall: reject only when the actual profession/work is materially different from every approved direction that found the vacancy. Title overlap alone is insufficient, but an unfamiliar profession name is never an automatic rejection.

Output must be validated against the input. A KEEP result whose `directionKey` was not supplied in that candidate's `foundBy` is invalid.

## Existing Search Result Contract

Preserve the existing Live Matches output shape. Convert the semantic 0-100 score into the existing search evaluation scale expected by the UI/storage contract rather than changing Live Matches rendering.

Keep Primary/Adjacent provenance in the evaluation breakdown. Primary/Adjacent may influence ranking only after semantic compatibility has been established; they must not create a hard profession/domain gate.

## Failure Handling

If Full JD cannot be read, preserve existing UNVERIFIED/access-limited behavior.

If semantic evaluation fails or returns invalid structured output, do not falsely reject the vacancy. Mark that candidate as unverified for search evaluation, surface access-limited/error audit information, and allow the run to complete honestly without fabricating a KEEP/REJECT result.

No fallback may re-enable BUG #4 Delivery Domain, Role Family, or hardcoded Danish logic.

## Versioning

New Search Runs use a new evaluation version, `profile-semantic-v1`, so stored runs can be distinguished from BUG #4 `profile-v1` results.

No database schema migration is required because `evaluation_version` already exists.

## Testing Requirements

At minimum, automated tests must prove:

1. English IT Project Manager positive case is kept.
2. Danish equivalent role/JD is kept without a Danish translation dictionary.
3. At least one non-Danish/non-English language case is kept through the same semantic interface.
4. IT Project Manager vs highway/civil construction work is rejected by semantic mismatch, not blacklist logic.
5. `Concept Artist` works despite not belonging to the former fixed Role Family taxonomy.
6. `Artist Relations Manager` is rejected against `Concept Artist` based on JD meaning.
7. Blank exclusions do not create ERP/R&D or other hidden exclusions.
8. Explicit deterministic user exclusions still execute.
9. Invalid semantic direction keys are rejected as invalid model output.
10. Semantic provider failure yields UNVERIFIED/access-limited behavior, not false REJECT.
11. Discovery deep pagination and dedupe regressions remain green.
12. JD batching/resume and Search Run persistence regressions remain green.
13. Existing geography behavior is unchanged.
14. Right-side MATCH CV AND JD regression tests remain green and no right-panel files are modified.

## Final Pipeline

```text
EXISTING SEARCH PROFILE
        ↓
USER-APPROVED PRIMARY + ADJACENT ROLES
        ↓
EXISTING LINKEDIN DISCOVERY BY ROLE TITLE
        ↓
EXISTING DEEP PAGINATION
        ↓
EXISTING DEDUPLICATION + foundBy
        ↓
EXISTING SEARCH RUN
        ↓
FULL JD BATCH PROCESSING
        ↓
EXPLICIT USER EXCLUSIONS
        ↓
MULTILINGUAL SEMANTIC ROLE/JD COMPARISON
Search Profile direction(s) ↔ Vacancy title + Full JD
        ↓
SEARCH RELEVANCE
        ↓
KEEP / REJECT
        ↓
LIVE MATCHES
        ↓
STOP — RIGHT PANEL IS UNCHANGED
```
