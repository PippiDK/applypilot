# ApplyPilot v0.7.2 — no-key company search

This build removes the runtime dependency on a Datafordeler credential.

Search path:
1. User selects only radius from Nærum and supplies the Master CV already stored in ApplyPilot.
2. Public Jobnet index discovers active vacancies in the hard-coded target profession family.
3. Public DAWA postal geography enforces the selected radius from Nærum.
4. Full JD is mandatory. External Jobnet listings are read from the employer/ATS page; internal listings use Jobnet detail text.
5. Public APICVR enriches the employer with CVR industry/size/website data; the hard-coded employer profile is applied.
6. The full JD is compared with the full Master CV using a conservative local evidence gate. A matching title alone never passes.
7. Only passing vacancies are returned.

No Datafordeler key, MitID, user API key or card is required for this search path.

Unchanged: CV parser, profile UI, radius choices, CV review/tailoring UI, styling and other API routes.
