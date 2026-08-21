# ApplyPilot MVP — Search + Matching Engine v0.2

Built by extending the original v0.1 evaluator, not replacing it.

## What v0.2 adds

1. **Live source layer**
   - Jobnet public BFF search + full JobAdDetails
   - The Hub public board feed
   - Remote OK public JSON feed
   - We Work Remotely RSS
   - All other mandatory Master-Prompt sources are reported honestly as `ACCESS LIMITED` until a stable connector exists.

2. **Search pipeline**
   - ingest
   - normalize
   - require a real/full JD before detailed evaluation
   - freshness filter
   - title/JD discovery gate (title is only a signal)
   - deduplicate
   - hard filters
   - full-JD + supplied Master-CV evaluation
   - NEW / UPDATED / SEEN history
   - max 10 worthwhile results

3. **Master Prompt v2 scoring**
   - 40% actual responsibilities / delivery ownership
   - 25% experience & domain match against the supplied Master CV text
   - 20% geography / work model
   - 15% career / compensation value
   - hard exclusions override score

4. **Hard rules implemented**
   - mandatory professional/fluent Danish → reject
   - R&D / scientific / hardware product-development roles → reject
   - BAU/support/service operations → reject when delivery ownership is absent
   - coordination-only roles → reject
   - assistant/coordinator level → reject
   - no meaningful technology/digital delivery ownership → reject
   - Program Manager only when execution/delivery is strong
   - Product roles only when delivery execution ownership is present

## Important truth rule

The evaluator never invents candidate experience. Candidate-specific evidence is counted only when a term exists in **both** the full JD and the `resume_text` supplied to the API.

## Run

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
pytest -q
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`.

### `POST /search`

Requires the Master CV text:

```json
{
  "resume_text": "<full parsed Master CV text>",
  "freshness_days": 7,
  "max_results": 10,
  "include_remote_eu": true,
  "only_new_or_updated": true
}
```

The response includes:
- worthwhile vacancies only;
- score/verdict/action;
- MATCH and GAPS;
- original/official URL when available;
- source coverage statuses;
- pipeline counters.

## Source honesty

The Master Prompt says not to claim a source was searched when access failed. v0.2 therefore exposes `SEARCHED`, `ACCESS LIMITED`, `NOT ACCESSIBLE`, or `NO RELEVANT RESULTS` per source. Unsupported job boards are not silently replaced by another source.

## Next technical slice

Add stable connectors for the remaining Denmark/recruitment sources and official target-company ATS pages, while keeping the evaluator unchanged.
