# ApplyPilot Web MVP v0.5.1 — AI Evidence-Driven Tailoring

This release replaces deterministic phrase replacement with vacancy-specific AI tailoring.

## What changed
- Full Job Description + verified Master CV evidence are sent to a server-side AI tailoring route.
- AI selects the strongest existing CV evidence for the specific vacancy.
- AI may rephrase emphasis/order/terminology, but may not invent claims.
- Server-side Truth Guard validates source IDs and rejects unsupported numbers/acronyms.
- Tiny grammar/cosmetic edits are filtered out; only meaningful diffs are shown.
- Different JDs should produce different proposed CV updates from the same Master CV.
- Review UI remains Original → Updated → Why changed → Source → Accept/Keep.
- Re-run AI tailoring is available after editing a JD.

## AI runtime
Uses Vercel AI SDK + AI Gateway model `openai/gpt-5.5` by default.
On Vercel, AI Gateway can authenticate automatically through OIDC. If OIDC is unavailable, add `AI_GATEWAY_API_KEY` in Vercel Environment Variables.
Optional model override: `AI_MODEL`.

## Truth Guard
The LLM never receives permission to invent experience. Each returned rewrite must reference a supplied CV evidence ID. The server discards proposals that:
- cannot be anchored to a verified source,
- introduce unsupported numeric/acronym claims,
- are merely cosmetic/minor wording edits.

## Current scope
- Jobs are still demo jobs unless their JD is replaced in the UI.
- Cover-letter generation comes later.
- Accepted changes are reviewed in-browser; final document export is a later step.
