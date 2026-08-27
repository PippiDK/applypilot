# ApplyPilot Profile Role Eligibility Gate — Design

Date: 2026-08-27
Branch: `feature/cv-library-3-slots`
Status: Proposed for implementation after user review

## 1. Problem

The new Search Run architecture successfully retrieves and evaluates the complete observable public LinkedIn result set without the previous single-request timeout ceiling. A live 7-day run completed with 442 discovered jobs and 442 verified Full JDs.

The remaining problem is precision: 111 jobs were classified as worthwhile, including obvious non-target roles such as roads/highways project management, mechanical construction project management, finance-only project management, SAP/ERP specialist project management, R&D project management, and regulatory-affairs specialist roles.

The root cause is not discovery or batching. It is the current profile-role confirmation model:

1. Generic role directions such as `Enterprise Project Manager` can match almost any `Project Manager` title.
2. Adjacent directions such as `Regulatory Project Manager` can overmatch roles that share only `regulatory` but are not project/delivery roles.
3. Current deterministic exclusions are mostly literal substring matches. Rules like `R&D roles` or `ERP specialist roles` therefore do not function as robust domain gates.
4. Role similarity and JD token support are currently allowed to produce KEEP before the evaluator has independently established that the vacancy belongs to the target professional family and target delivery domain.

## 2. Goal

Increase precision substantially without sacrificing the recall improvements that protect non-English and non-standard target titles.

The evaluator must answer these questions in order:

1. Is the vacancy explicitly excluded by the Search Profile?
2. Is this the correct professional role family?
3. Is the delivery domain compatible with the Search Profile?
4. If compatible, which approved Search Profile direction does it match?
5. Only then: what Search relevance score should it receive?

The solution must not impose any hidden quota or target number of returned jobs. A run may return 4, 20, or 40 jobs if that is what the evidence supports.

## 3. Non-goals / frozen areas

This change must NOT alter:

- Search Run persistence architecture
- Supabase search-run schema
- LinkedIn discovery pagination
- LinkedIn Full-JD batching / continuation
- deduplication by LinkedIn job ID
- Search Profile generation or user editing
- Union Search Plan construction
- Primary / Adjacent provenance
- CV logic
- JD↔CV Expertise Match
- the current Search relevance scoring formula after eligibility has passed, unless a test proves a scoring-only bug unrelated to eligibility
- BUG #3 multilingual role normalization and its protected positive cases
- deployment behavior
- `main`

The fix operates only inside the profile-driven evaluator boundary after a Full JD has been retrieved.

## 4. Decision model

The evaluator becomes a staged eligibility pipeline:

```text
FULL JD
  ↓
EXPLICIT SEARCH PROFILE EXCLUSIONS
  ↓
ROLE FAMILY CLASSIFICATION
  ↓
DELIVERY DOMAIN CLASSIFICATION
  ↓
┌──────────────────┬───────────────────┬────────────────────┐
│ TARGET           │ AMBIGUOUS         │ NON_TARGET/EXCLUDED│
│ ↓                │ ↓                 │ ↓                  │
│ ROLE DIRECTION   │ HOLD              │ REJECT             │
│ CONFIRMATION     │ audit only        │ audit only         │
│ ↓                │                   │                    │
│ EXISTING SCORE   │                   │                    │
│ ↓                │                   │                    │
│ KEEP             │                   │                    │
└──────────────────┴───────────────────┴────────────────────┘
```

### 4.1 Explicit Search Profile exclusions

User-authored exclusions are evaluated first and always override positive role similarity.

Existing deterministic company, location, work-model, language, employment-type and literal role/domain exclusions continue to work.

For exclusion rules that express a category rather than a literal phrase, the evaluator adds a conservative semantic interpretation. The initial protected semantic exclusion categories are those already represented by the current Search Profile, especially:

- R&D-specialist roles
- ERP-specialist roles

Example: the user rule `R&D roles` must reject `Senior Project Manager, Global R&D, Respiratory & ENT` even though the exact string `R&D roles` is not present in the vacancy.

Example: the user rule `ERP specialist roles` must reject `SAP S/4HANA Public Cloud Finance Project Manager` when the Full JD establishes that the role is an ERP/SAP specialist position.

Semantic expansion must never invent a new user exclusion. Physical construction, finance-only, HR-only, marketing-only and similar non-target domains are handled by delivery-domain compatibility unless the user has explicitly excluded them.

### 4.2 Role family classification

Role family is determined independently from the Search Profile direction match.

Initial families:

- `delivery-management`
- `implementation-transformation`
- `product`
- `architecture`
- `analysis`
- `quality-test`
- `software-builder`
- `specialist`
- `executive`
- `other`

The primary target families for the current Search Profile are delivery/project/program/implementation/transformation families. A vacancy from a conflicting family cannot pass only because one title token overlaps with a Search Profile direction.

Example:

`Regulatory Affairs Specialist`

must classify as `specialist`, not as delivery-management, and therefore cannot pass as `Regulatory Project Manager` merely because `regulatory` matches.

### 4.3 Delivery domain classification

Delivery domain is classified from title + Full JD evidence.

Initial domain outcomes:

- `TARGET_TECH`
  - IT
  - software
  - platform
  - enterprise systems
  - cloud
  - data / BI / analytics platforms
  - digital delivery
  - integrations / APIs / middleware
  - cybersecurity / OT when the role is project/delivery management rather than a specialist-only role
  - technology-enabled transformation
- `NON_TARGET_PHYSICAL`
  - construction
  - civil engineering
  - roads / highways
  - buildings
  - utilities infrastructure
  - physical plant / mechanical project delivery
- `NON_TARGET_FUNCTIONAL`
  - finance-only
  - HR/payroll-only
  - marketing/content-only
  - procurement-only
  - property/facilities-only
  - regulatory-affairs-only
- `EXCLUDED_SPECIALISM`
  - a semantic category explicitly excluded by the Search Profile, such as ERP specialist or R&D specialist
- `AMBIGUOUS`
  - project/delivery role is plausible but the Full JD does not provide enough evidence to establish a compatible delivery domain

The classifier must use evidence groups rather than one-off word lists. Multiple corroborating signals are preferred over a single token.

A functional domain is not automatically rejected if the Search Profile explicitly enables that professional direction and the role is genuine delivery management. For example, a true regulatory project-management role may remain eligible through an approved `Regulatory Project Manager` direction, while `Regulatory Affairs Specialist` remains ineligible because its role family is specialist rather than delivery-management.

Likewise, `Implementation Manager` does not automatically make every HR/payroll implementation role worthwhile. The Full JD must establish delivery responsibilities compatible with the approved direction rather than a narrow functional-specialist position.

Danish and English evidence must both be supported. Existing BUG #3 normalization remains and is extended only where needed to classify delivery domain safely.

### 4.4 Ambiguous / HOLD outcome

If role family is compatible but the delivery domain cannot be established with sufficient confidence, the vacancy does NOT enter `worthwhile`.

It is retained in the audit with:

- stage: `PROFILE_DOMAIN_AMBIGUOUS`
- decision: `HOLD`
- score: no Search relevance score
- reason: `Delivery domain is not sufficiently confirmed from the Full JD`

This preserves recall without polluting the shortlist.

HOLD is not equivalent to REJECT and must remain visible in the audit.

### 4.5 Search Profile direction confirmation

Only vacancies that pass eligibility proceed to the existing approved-direction matcher.

The current Primary/Adjacent direction list remains authoritative.

The direction matcher must not be used as a substitute for role-family or delivery-domain classification.

### 4.6 Search relevance scoring

The existing Search relevance score is calculated only after eligibility passes.

A score must therefore mean:

`The vacancy is professionally eligible AND this is how strongly it matches an approved Search Profile direction.`

A high token-similarity score must never resurrect an explicitly excluded or non-target-domain role.

## 5. Audit semantics

The audit should become more diagnostic.

Expected stages include:

- `PROFILE_EXCLUSION_REJECT`
- `PROFILE_ROLE_FAMILY_REJECT`
- `PROFILE_DOMAIN_REJECT`
- `PROFILE_DOMAIN_AMBIGUOUS`
- `PROFILE_ROLE_REJECT`
- `KEPT`

Examples:

- `PROFILE_DOMAIN_REJECT · Physical construction / civil infrastructure delivery`
- `PROFILE_EXCLUSION_REJECT · ERP specialist role`
- `PROFILE_EXCLUSION_REJECT · R&D specialist role`
- `PROFILE_ROLE_FAMILY_REJECT · Specialist role is not project/delivery management`
- `PROFILE_DOMAIN_AMBIGUOUS · Delivery domain is not sufficiently confirmed from the Full JD`

`worthwhile after evaluation` counts only `KEPT` jobs. HOLD remains audit-only.

## 6. Regression corpus

The live 442-job run is the source for a focused real-world regression corpus.

### Must remain KEEP

These cases protect recall and BUG #3:

- Ambu — `Senior IT Project Manager`
- Atea Danmark — `Senior IT-projektledere med teknisk indsigt`
- PET / Politi — `Kan du drive succesfulde strategiske IT projekter i PET?`
- Annapurna — `Integration Project Manager`
- Twoday — `Senior Project Manager – Data Platform Modernisation`
- Regionshospitalet Gødstrup — `Erfaren projektleder søges til kliniknær digitalisering`

### Must become REJECT

- Jacobs — `Senior Project Manager - Roads and Highways`
  - reason category: physical infrastructure
- Turner & Townsend — `Senior Mechanical Construction Project Manager ... Data Centres`
  - reason category: mechanical/construction delivery
- Danish Crown — `Senior Finance Project Manager`
  - reason category: finance-only delivery
- Eursap — `SAP S/4HANA Public Cloud Finance Project Manager`
  - reason category: ERP specialist exclusion
- Ambu — `Senior Project Manager, Global R&D, Respiratory & ENT`
  - reason category: R&D specialist exclusion
- Phillips Medisize — `Regulatory Affairs Specialist`
  - reason category: specialist family, not delivery-management

### Must become HOLD when evidence is insufficient

At least one generic `Project Manager` fixture must contain plausible delivery-management language but no reliable technology/domain evidence. It must produce `PROFILE_DOMAIN_AMBIGUOUS / HOLD`, not KEEP and not hard REJECT.

## 7. Testing strategy

Implementation must follow TDD.

Required tests:

1. RED regression tests for every protected KEEP and REJECT example above.
2. RED test for the HOLD/AMBIGUOUS path.
3. Explicit Search Profile exclusions override otherwise strong title similarity.
4. Semantic expansion of R&D/ERP exclusions is applied only when the corresponding user exclusion exists.
5. Role-family conflict overrides shared tokens.
6. Domain evidence is based on Full JD, not title-only.
7. Danish BUG #3 cases remain GREEN.
8. Primary/Adjacent provenance and direction scoring remain unchanged for eligible vacancies.
9. `worthwhile` count includes only KEEP.
10. Audit differentiates REJECT, HOLD and KEEP.
11. Search Run discovery/batching tests remain unchanged and GREEN.

A larger replay-oriented regression set should be extracted from the 442-job live audit where practical, but implementation must not depend on reproducing live LinkedIn network calls.

## 8. Implementation boundaries

Preferred code boundary:

- keep orchestration in `linkedin-profile-evaluator.js`
- extract eligibility concerns into small pure modules/functions if the evaluator would otherwise become monolithic, for example:
  - `profile-role-family.js`
  - `profile-delivery-domain.js`
  - `profile-semantic-exclusions.js`

Each unit must be pure and independently testable from fixture objects containing title, description, company and metadata.

Do not add an LLM/API call to this gate. The first implementation remains deterministic, fast, auditable and free of additional per-job inference cost.

Do not add database schema changes for BUG #4.

## 9. Success criteria

The fix is accepted when:

1. The 442/442 retrieval capability is unchanged.
2. Protected target cases remain KEEP.
3. Protected false positives become the expected REJECT category.
4. Ambiguous generic PM cases become HOLD, not worthwhile.
5. Explicit Search Profile exclusions have precedence over positive role matching.
6. Semantic exclusion expansion never creates a new exclusion the user did not configure.
7. No hidden shortlist quota is introduced.
8. Search relevance is only assigned after eligibility passes.
9. Existing Search Run, Union Search Plan, CV and BUG #3 regression suites remain GREEN.
10. Production build is GREEN.
11. `main` remains unchanged and deployment remains permission-gated.

## 10. Explicit design decision

The recommended and approved architecture is:

**Eligibility Gate + Role Family + Delivery Domain + explicit exclusion precedence + AMBIGUOUS/HOLD, followed by the existing Search Profile direction matcher and existing score.**

We intentionally reject the alternatives of merely increasing similarity thresholds or maintaining an ever-growing blacklist, because both approaches either destroy recall or become brittle and unmaintainable.
