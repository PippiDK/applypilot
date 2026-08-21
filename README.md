# ApplyPilot v1.0 — LinkedIn public E2E

This package is intentionally a **Next.js web project**, matching the Vercel project that is already connected to GitHub.

Single milestone only:

LinkedIn public search → public job detail page → full JD → Master CV evaluator → worthwhile matches.

No Jobnet. No CVR. No company discovery. No remote boards. No AI Gateway.

## Run

```bash
npm install
npm test
npm run build
npm start
```

## Production diagnostics

`POST /api/linkedin-search` logs one compact line with source coverage, stage counters and failures. Source failures are surfaced as errors or `ACCESS LIMITED`; they are never converted into a fake successful `0 jobs` response.
