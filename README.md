# ApplyPilot Web MVP v0.3.2

Functional CV evidence layer for a human-in-the-loop job-search autopilot.

## v0.3.2
- Real server-side CV parsing for PDF and DOCX
- Career Fact Bank extracted from the uploaded Master CV
- Skills/signals detected from CV text
- Honest application-pack statuses (no fake “Ready”)
- Career Fact Bank viewer
- Review Application flow grounded in verified CV facts
- Truth Guard messaging and evidence IDs
- Safe tailoring preview anchored to the original fact
- External job link action
- Search profile remains stored locally in the browser

## Current limitations
- The job cards are still demo jobs; live job-source ingestion is not connected yet.
- Tailoring is deterministic and conservative in v0.3; an LLM-backed rewriter comes later.
- Cover letter generation is intentionally not yet enabled.
- Legacy .doc parsing is not supported; use PDF or DOCX.

## Deploy
Push all files to the connected GitHub repository. Vercel will redeploy automatically.


### v0.3.2 hotfix
- Upgraded pdf-parse from legacy 1.1.1 to 2.4.5.
- Uses the v2 PDFParse API and always destroys the parser after extraction.
- Fixes the Vercel build failure caused by the legacy package trying to open ./test/data/05-versions-space.pdf.


## v0.3.2 hotfix
- Fix Vercel runtime DOMMatrix error for PDF parsing
- Use pdf-parse CanvasFactory from pdf-parse/worker
- Add @napi-rs/canvas for Node serverless DOM/canvas polyfills
- Externalize PDF native packages in Next.js server build
