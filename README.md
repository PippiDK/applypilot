# ApplyPilot Web v0.7.1 — Danish Company Search

This version changes only the search layer to the company-first search agreed for ApplyPilot.

## Search criteria
1. **Radius from Nærum** — the only user-selectable search criterion: 10 / 20 / 30 / 40 / 50 km.
2. **Company profile** — internal hardcoded employer criteria. Companies outside the agreed employer profile are not considered.
3. **Profession family** — internal hardcoded IT/project/delivery role family.
4. **Mandatory final gate** — a vacancy is shown only after ApplyPilot has retrieved a full job description and compared the full JD with the full Master CV. Title match alone is not enough.

If a company or vacancy fails any gate, it is not shown.

## Company source
- Official Danish CVR data through Datafordeler.
- Exact radius is calculated from the registered company address to Nærum.
- ApplyPilot then follows the company's public web presence to its career/jobs pages and only evaluates matching role candidates with a full JD.

## Server configuration
ApplyPilot uses one Datafordeler credential on the server for the application itself. End users never create, enter, receive, or see a Datafordeler credential.

Vercel server environment variable:

`DATAFORDELER_API_KEY`

The value is read only inside the server-side `/api/company-search` route. The browser sends only the selected radius and Master CV content required for the agreed search flow. The API key is never accepted in request data and is never returned in responses.

The final full-JD-vs-CV decision uses the existing Vercel AI Gateway. If that gate is unavailable, the search fails closed rather than showing unverified matches.
