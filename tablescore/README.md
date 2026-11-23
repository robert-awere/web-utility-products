# TableScore v0.2

Browser-only Hand and Foot score keeper. Static site. No accounts, no live ads, no analytics, no backend.

## SSG choice: Astro

Astro is the SSG for this sandbox because:

- Output is static HTML. There is no server for scoring (FR-10).
- JavaScript is shipped only for the scorekeeper island. The explainer, FAQ, about, contact, privacy, and printable sheet are HTML.
- That keeps page weight in the PRD band of under 150KB excluding ads, without a UI kit.
- Vanilla JS mounts on one page. The scoring engine is an ordinary ES module, testable with node --test and never imported into markup as arithmetic.

Eleventy would also have worked. Astro was chosen so the tool can be a real client module without a separate bundler config.

## Where this tree lives

This project is on the box at:

`/workspace/simple-web-utility/tablescore-v0.2/`

Copy the whole tablescore-v0.2 folder onto Robert's computer, then run the commands below from inside that folder.

## Run

```
npm install
npm run dev
```

Dev binds 127.0.0.1:4321 only (loopback). Do not change the host to a public or LAN address.

- Tool: http://127.0.0.1:4321/hand-and-foot-score-keeper/
- PDF: http://127.0.0.1:4321/hand-and-foot-score-sheet.pdf
- Tests: `npm test`
- Static build: `npm run build`

## What is in this version

- One game: Hand and Foot. Homepage lists only that game.
- Shared scoring engine as pure functions (`src/engine/hand-and-foot.js`). No scoring math in the UI.
- Variants named from Pagat: Whitnack partnership (default), Steve Simpson, Saskatchewan.
- FR-1 through FR-10, plus FR-11 variant toggle and FR-12 test vectors.
- Downloadable four-deal score sheet PDF at `public/hand-and-foot-score-sheet.pdf` (also linked from the tool and printable page).
- Minimum service worker that caches the game page after first load. No PWA install prompt.
- About, contact, privacy, XML sitemap.

## Out of scope here

No other games, no stubs, no deploy, no domain pick, no ad network, no PWA install UI, no email capture, no websockets. The kanban folders were not touched.
