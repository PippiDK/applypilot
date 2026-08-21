# ApplyPilot v0.8.4 — Company Discovery geometry fix

Step 1 only: company discovery around Nærum.

Change from v0.8.3: company discovery no longer performs municipality × employee-band request fan-out. It uses the CVR geometry endpoint, which supports multi-value municipality and six-digit industry-code filters, then batch-fetches company details by CVR number. BLOO's keyless CVR API is used only as a limited fallback if the detail batch source returns nothing.

No vacancy, JD, CV matching, AI, or application logic was added.
