# ApplyPilot Web MVP v0.5

Human-in-the-loop job-search autopilot for senior IT / project / delivery professionals.

## v0.5 — Job Description Driven Tailoring

- Each job now carries a full Job Description (JD), not only a title and a few demo signals.
- Users can **View / edit job description** and paste a complete vacancy text.
- ApplyPilot deterministically extracts known delivery requirements from the JD.
- Match reasons and gaps are derived from **JD requirements ↔ verified CV evidence**.
- The fit score is recalculated from the detected JD requirements supported by the CV.
- CV Update Review is now vacancy-specific: different JDs produce different proposed wording changes.
- Proposed CV updates still show only genuine Original → Updated diffs.
- Truth Guard remains strict: wording can only restate evidence already present in the Master CV.
- Internal evidence IDs remain hidden from the user interface.
- CV parser remains the working PDF/DOCX implementation from v0.3.2.
- Cover-letter generation remains intentionally pending.

## v0.5 deterministic requirement catalogue

The prototype detects common senior IT delivery requirements such as end-to-end delivery, distributed teams, release/go-live, risk and dependencies, executive stakeholders, Azure/cloud, technical delivery, integrations, governance, regulatory/compliance, budget ownership, multi-workstream programme scope, Agile/Hybrid and data/BI.

This is intentionally deterministic for MVP validation. A semantic/LLM requirement extractor can replace the catalogue later without changing the UI flow.

## Truth rule

ApplyPilot may rephrase verified experience, but may never invent skills, achievements, employers or responsibilities.

## Current limitations

- Job cards are still demo jobs; live job-source ingestion is not connected yet.
- JD extraction uses a deterministic requirement catalogue rather than an LLM.
- Tailoring is conservative and rule-driven.
- Cover letter generation is not yet enabled.
- User data and decisions are still browser-local rather than database-backed.

## Deploy

Push all files to the connected GitHub repository. Vercel will redeploy automatically.
