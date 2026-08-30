# Jobindex Multi-Source Search Design

Date: 2026-08-30
Status: Approved in chat, pending written-spec review

## 1. Goal

Add Jobindex as a second selectable job-discovery source while preserving the existing Search Profile and downstream evaluation model. Users must be able to choose which sources participate in a search from the main screen.

The design must keep source acquisition isolated from the common job-processing pipeline so future sources can be added without duplicating profile or evaluator logic.

## 2. Product Rules

### Search Sources

The main screen shows a compact `SEARCH SOURCES` control with equal treatment for the currently supported sources:

- LinkedIn
- Jobindex

Both are enabled by default for a new user.

The user's last source selection is remembered across sessions.

Source selection is stored independently from Search Profile state.

If no source is selected, Search does not start and the UI shows a short validation message such as `Select at least one search source.`

### Search Profile

Search Profile remains the single definition of what to search for. Its logic is not duplicated or split by source.

Conceptually:

- Search Profile = what to search for
- Search Sources = where to search

The existing Search Profile logic must not be redesigned as part of this feature.

### Result Source Display

Each result card shows its source provenance in a simple user-facing form:

- `Source: LinkedIn`
- `Source: Jobindex`
- `Source: LinkedIn · Jobindex`

No PRIMARY label is used.

## 3. Architecture

Use source adapters plus a shared downstream pipeline.

```text
Search Profile + Filters + Enabled Sources
                  |
          Source Orchestrator
          /               \
 LinkedIn Adapter     Jobindex Adapter
          \               /
               Normalize
                  |
        Conservative Dedupe
                  |
              Full JD
                  |
        Existing Evaluator
                  |
            Live Matches
```

### 3.1 Source Orchestrator

A new orchestration layer receives:

- Search Profile
- current search filters
- enabled source IDs

It launches only the selected source adapters.

Sources should be executed in parallel so a slow source does not unnecessarily delay another source.

The orchestrator gathers each source result and its execution status. A failure in one source must not fail the entire search when another source succeeds.

Internal source execution states may include `success`, `partial`, and `failed`, but technical adapter status should not be exposed directly in the user interface.

### 3.2 LinkedIn Adapter

The LinkedIn adapter is a thin wrapper around the existing LinkedIn search flow.

The feature must not rewrite the existing LinkedIn discovery, query-expansion, pagination, or evaluation behavior merely to support Jobindex.

The adapter's responsibility is to invoke the existing LinkedIn discovery flow when LinkedIn is enabled and convert its output into the common normalized job contract.

LinkedIn may be disabled by the user, including for isolated testing.

### 3.3 Jobindex Adapter

Jobindex is implemented as a separate source-specific adapter.

Its responsibility is limited to Jobindex acquisition concerns, including:

- deriving Jobindex-compatible searches from the approved Search Profile and common filters
- fetching Jobindex search results
- handling pagination
- extracting stable job identifiers and URLs
- fetching job detail pages where needed
- extracting the available job data and full JD
- converting records to the common normalized job contract

Jobindex-specific parsing details must not leak into the evaluator.

The earlier throwaway probe established technical feasibility for direct Vercel fetching of Jobindex search pages, `page=2` pagination, stable `h...` job IDs, and canonical `/vis-job/<id>` detail pages. The probe implementation itself is not production code and must not be merged as the feature implementation.

## 4. Common Job Contract

All source adapters return the same normalized representation before common processing.

Minimum shared fields:

- `jobId`
- `title`
- `company`
- `location`
- `postedDate`
- `detailUrl`
- `applicationUrl`
- `fullJd`
- `sourceRecords`

`sourceRecords` preserves source-specific provenance rather than collapsing provenance to a single string. It must be able to represent multiple source records for one merged vacancy.

Example conceptual shape:

```text
sourceRecords = [
  { source: 'linkedin', ... },
  { source: 'jobindex', ... }
]
```

The UI derives the simple source label from this provenance.

The evaluator should receive normalized jobs and should not need source-specific branching for LinkedIn versus Jobindex.

## 5. Common Filters

Current user-facing filters apply consistently across all enabled sources.

This includes the existing search concepts such as:

- Posted Within
- Areas
- Hybrid
- On-site
- Remote
- Remote Scope

There are no separate `LinkedIn filters` and `Jobindex filters` in the product model.

An adapter may need source-specific mechanics to approximate or retrieve those constraints, but it must produce output that respects the common ApplyPilot filter semantics.

## 6. Cross-Source Deduplication

Deduplication is intentionally conservative in version 1.

The priority is to avoid losing a potentially relevant vacancy through an incorrect merge.

Rules:

- merge only when confidence is high that two source records refer to the same vacancy
- preserve both source records when a merge is performed
- if confidence is insufficient, keep both vacancies as separate result candidates
- do not attempt aggressive fuzzy dedupe in the first release

Candidate matching signals may include normalized company, title, location, canonical application URL, detail URL relationships, or other high-confidence identifiers. The implementation plan should define the first safe matching rule set, but it must preserve the conservative behavior above.

The first TEST release should be evaluated against real output. If duplicate volume is high, matching can be tightened later based on observed cases rather than speculative rules.

## 7. Full JD Selection

After source normalization and dedupe, the common pipeline should use the best available JD data for the merged vacancy.

If one source record lacks a usable full JD but another source record for the same vacancy has one, use the available full JD.

If no usable full JD is available, do not silently discard the vacancy solely for that reason. Preserve it with an explicit limited-data/evaluation state so the product does not present the result as fully evaluated.

## 8. Error Handling

The system follows a fail-soft model.

### Source-Level Failure

Examples include timeout, HTTP 403/500, network failure, or source parser failure.

A failed source does not block successfully completed sources.

User-facing behavior should be simple, for example:

`Jobindex search unavailable`

If everything succeeds, no source-status noise is shown.

### Record-Level Failure

A malformed job record must not fail the entire source batch. The record is skipped or retained in a limited form as appropriate, and the failure is logged with an explicit reason.

### Detail/JD Failure

If a detail page cannot be fetched but enough basic vacancy data exists, the vacancy should not automatically disappear. Preserve it with a limited-data state.

### Evaluation Failure

A per-job evaluator failure must not silently remove the vacancy. It should result in a clear fallback/status that can be diagnosed.

### Retries and Timeouts

Each source has independent timeout and retry behavior. Retries must be conservative to avoid unnecessary load and source blocking.

## 9. Logging and Auditability

Source-specific failures must be distinguishable in logs and diagnostics.

The system should make it possible to determine whether a failure occurred in:

- LinkedIn discovery
- Jobindex discovery
- source parsing
- detail/JD retrieval
- normalization
- dedupe
- evaluator

No vacancy should disappear from the pipeline without a traceable reason.

## 10. UI Behavior

The `SEARCH SOURCES` control belongs on the main search screen rather than being hidden in Settings.

The feature is user-visible product functionality: users can see and control where ApplyPilot searches.

The UI remains compact and avoids technical implementation language.

Normal state:

```text
SEARCH SOURCES
☑ LinkedIn
☑ Jobindex
```

The control supports:

- LinkedIn only
- Jobindex only
- LinkedIn + Jobindex

The selection is remembered across sessions.

## 11. Testing and Acceptance Criteria

### Source Isolation

- LinkedIn-only search works without regression from the existing LinkedIn flow.
- Jobindex-only search works independently.
- LinkedIn + Jobindex runs both sources and combines their output.

### Jobindex Discovery

The production adapter must prove:

- Jobindex search retrieval
- pagination
- robust extraction of required normalized fields
- detail-page retrieval where necessary
- full-JD extraction where available
- adherence to common freshness and location/filter semantics

### Dedupe

- an obvious same vacancy from both sources can merge into one normalized job
- merged job retains both source records
- UI shows `LinkedIn · Jobindex`
- uncertain duplicates stay separate
- version 1 does not optimize aggressively for minimum duplicate count

### Failure Isolation

- if LinkedIn fails and Jobindex succeeds, Jobindex results continue
- if Jobindex fails and LinkedIn succeeds, LinkedIn results continue
- if an individual job record fails parsing, the whole search does not fail
- a missing full JD does not silently delete the vacancy

### Settings

- both sources are selected by default for a new user
- user source selection persists across sessions
- source selection remains independent of Search Profile
- zero selected sources prevents search and shows a concise validation error

### Existing Logic Protection

- Search Profile behavior is not changed as part of source selection
- existing LinkedIn discovery/query expansion/pagination behavior is preserved
- the evaluator remains common rather than being duplicated by source

## 12. Out of Scope for Version 1

- additional sources such as The Hub or Jobnet
- aggressive fuzzy dedupe
- separate source-specific Search Profiles
- separate source-specific evaluators
- hidden technical adapter controls in the end-user UI
- productionizing the temporary Jobindex probe route
- changing the existing LinkedIn search algorithm merely to accommodate Jobindex

## 13. Implementation Boundary

This feature should be implemented in a dedicated feature branch. The existing `main` branch must remain unchanged until the feature has been implemented, tested in TEST, reviewed, and explicitly approved for merge.

The temporary `spike/jobindex-vercel-probe` code is evidence only and should remain throwaway; the production Jobindex adapter should be designed cleanly from the verified behavior rather than copying the probe route as architecture.
