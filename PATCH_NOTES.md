# ApplyPilot — Animated Expertise Match dots

Upload these files to the existing `ui-redesign` branch, preserving paths.

Changed:
- `app/layout.js` — adds one import for the isolated loader stylesheet.
- `app/expertise-loader.css` — animates the three Expertise Match loading dots in a wave while `.expertiseLoading` is present.
- `app/lib/expertise-loader-ui.test.mjs` — regression test for the loader animation wiring.

Not changed:
- LinkedIn search engine
- left Live matches panel
- Expertise Match scoring / AI logic
- `app/page.js`
- `app/globals.css`

The animation automatically stops when analysis completes because the CSS selector is scoped to the existing loading state.
