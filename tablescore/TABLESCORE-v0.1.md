# TABLESCORE-v0.1

**Version:** TableScore v0.1
**Path:** `/workspace/simple-web-utility/tablescore-v0.1/`
**Date:** 16 August 2026
**Status:** Sandbox artifact for review. Not a final approval.

## What shipped

- Astro static site, vanilla JS scorekeeper, one complete game: **Hand and Foot**.
- Homepage directory lists only that game.
- Pages: `/`, `/hand-and-foot-score-keeper/`, `/printable/hand-and-foot-score-sheet/`, `/about/`, `/contact/`, `/privacy/`, `/sitemap.xml`.
- Shared score engine: `src/engine/hand-and-foot.js` (pure functions). UI in `src/client/scorekeeper.js` calls the engine and does not apply pile bonuses, card values, or red-three scores itself.
- FR-1 names (2-8), persist in localStorage.
- FR-2 structured inputs: natural / mixed / wild piles, red threes tabled and untabled, melded and leftover card counts, going-out.
- FR-3 running totals, deal history, leader.
- FR-4 undo last deal; edit any prior deal; recompute.
- FR-5 autosave on every input; reload restores; Resume game? within 24 hours.
- FR-6 new game with confirm; game ends after 4 deals (configurable 1-8; Pagat / Whitnack defines four deals, not a point target).
- FR-7 end summary and copy-to-clipboard text.
- FR-8 inputmode=numeric; 48px targets; 360px layout.
- FR-9 Screen Wake Lock while a game is active; no-op if missing.
- FR-10 scoring is client-side after load. No service worker (PWA is out of scope).
- FR-11 three named Pagat variants, persisted, default Whitnack (most usual on that page).
- Empty fixed-height ad slots A and B. No network, no ad scripts.
- 400-700 word original explainer tied to Pagat. FAQ (6) + FAQ schema + WebApplication schema.
- Footer about / contact / privacy with real text: scores stay in the browser; not affiliated with any publisher; no gambling vocabulary.
- Printable traditional four-deal sheet.

## Rules source

- **URL:** https://www.pagat.com/rummy/handfoot.html
- **Author / maintainer:** John McLeod (pagat.com)
- **Default text:** partnership rules contributed by Bill Whitnack (the most usual version)
- **Other named variants used:** Steve Simpson (individuals); Saskatchewan (Dave Petrie)
- **Retrieved:** 16 August 2026
- The same URL and date appear in the explainer and in RULES_SOURCE inside the engine.

### Variant notes (from that page, not invented)

| id | Name | Clean | Dirty | Wild | Out | Red 3s | Go-out piles |
|---|---|---|---|---|---|---|---|
| whitnack (default) | Whitnack partnership | 500 | 300 | 1500 | 100 | +100 tabled / -100 not | 2 clean, 2 dirty, 1 wild |
| simpson | Steve Simpson (individuals) | 300 | 100 | none | 100 | -500 always | 1 clean, 1 dirty |
| saskatchewan | Saskatchewan | 500* | 300* | 1500* | 100* | +100 / -100* | 1 clean, 1 dirty, 1 wild |

* Saskatchewan Pagat section does not republish pile bonuses or red-three treatment. This engine applies the Whitnack bonus table and says so in the variant copy and in this file.

## How to copy / run

The tree is on the box:

`/workspace/simple-web-utility/tablescore-v0.1/`

Copy that folder onto Robert's computer. Then, inside the copied folder:

```
npm install
npm run dev
```

Dev server: `http://127.0.0.1:4321/` (loopback only).

```
npm test
```

## Tested vs assumed

**Actually run (this session):**
- Scoring tests: 23 passed, 0 failed. Vectors include red 3s, going-out, mixed vs natural, and negative leftover/untabled cases.
- Dependencies resolved (Astro 5.18.2). Runtime: Node v20.19.2. Package-manager warning: 9.2.0 vs engine request >=9.6.5.
- Dev server bound 127.0.0.1:4321. HTTP 200 on home, Hand and Foot, printable, about, contact, privacy, sitemap, robots, favicon.
- Static build completed: 6 pages. Client JS 23.09 kB (7.92 kB gzip).

**Assumed, not instrumented in a phone lab:**

- One-handed use on a physical 360px phone (CSS is written for 360px; not tested on a real device).
- Wake Lock permission prompt on a real mobile browser (code requests it and swallows failure).
- Offline after first load (architecture is static + localStorage; not flight-tested).
- Lighthouse scores (not run).
- Clipboard on browsers without navigator.clipboard (execCommand fallback present, not exhaustively tested).
- Saskatchewan pile bonuses (assumed Whitnack table; flagged).

## Known limitations (up front)

- One game only. No Canasta or other roster pages.
- Partnership play is one named column per side, not two linked seats.
- The keeper does not validate wild-card limits inside a meld, initial-meld legality, or partner permission. Those happen at the table.
- Card-point entry is by count of ranks (jokers, twos/aces, 8-K, 4-7, black threes), not by tapping individual cards.
- No service worker, so a cold open with no network will not load the site. After the page has loaded, scoring does not call a server.
- Sitemap loc values are paths, not absolute URLs — no domain was chosen.
- Contact page has no form (no server, no email capture).
- Ad slots are empty boxes.
- robots.txt disallows crawlers; this is a sandbox.
- Saskatchewan / Simpson play-rule differences (discard-pile size, 11-card hand, adding past seven) are not simulated. Only published scoring differences are toggled.

## Out of scope

- No other games, no stubs, ever, in this version.
- No deploy, no GitHub clone, no domain registration or proposal.
- No live ads, analytics, accounts, websockets, PWA, email capture.
- Kanban folders (`/workspace/kanban-board-build` and any kanban path) were not touched.
- No Operator actions.

## Sibling-links gap (PRD vs this assignment)

PRD section 6 item 7 and SEO-5 want each game page to link to 3-5 sibling game pages, and the homepage to be a directory of all games.

This assignment narrows the roster to one complete game and forbids stubs. The Hand and Foot page therefore links to home, about, printable, privacy, and contact — pages that exist — and states the gap on the page. It does not invent Canasta, Pinochle, Cribbage, Spades, Hearts, Gin, Phase 10, Wizard, or Oh Hell URLs.

## Explainer gate

The explainer is game-specific (card values, pile bonuses, going-out gates, initial-meld ladder, named variants) and cites Pagat. If a later edit drifts into generic filler, reject that edit.

## File map

```
tablescore-v0.1/
  README.md
  TABLESCORE-v0.1.md
  package.json
  astro.config.mjs
  src/engine/hand-and-foot.js
  src/engine/hand-and-foot.test.js
  src/engine/storage.js
  src/client/scorekeeper.js
  src/pages/hand-and-foot-score-keeper/index.astro
  src/pages/printable/hand-and-foot-score-sheet.astro
  src/pages/{index,about,contact,privacy}.astro
```
