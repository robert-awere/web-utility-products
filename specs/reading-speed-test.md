# Spec: reading-speed-test — Reading Speed Test (WPM + comprehension)

Status: READY TO BUILD · TARGET_SITE=sites/reading-speed-test · Created 2026-11-04

## Goal
A leaner, faster, more shareable rival to freereadingtest.com. One page, zero
dependencies, no sign-up, no cookies required. Tap once, read, answer five
questions, get a WPM result you actually want to share. The share link lets a
friend take the *same passage* and beat the score — that is the viral loop.

Note: freereadingtest.com could not be fetched from the build environment
(host not in the network allowlist). Design is from category knowledge:
incumbents are text-heavy, ad-heavy, pick-a-passage-then-click flows with a
quiz and a WPM number, little or no sharing, dated design, no result URL.

## The test flow (exact)
1. Landing: H1, one-line lede, a big **"Start reading"** button and the passage
   card *hidden/blurred* (title + word count visible, body not readable).
   Passage is chosen at random on load unless `?p=<id>` is in the URL.
   Small secondary control: "Change passage" (cycles id, no reload).
2. Click Start → timer starts (`performance.now()`), passage body revealed,
   button becomes **"I'm done reading"** (also Space/Enter). Elapsed time is NOT
   shown while reading (it distorts behaviour). A quiet "reading…" indicator only.
3. Done → timer stops → **5 multiple-choice questions** (4 options each) shown
   one list, radio groups, button **"Show my result"** (disabled until all 5
   answered). No skip.
4. Result card (prominent, `role=status`):
   - Hero number: **WPM** (raw) — `Math.round(words / (ms/60000))`.
   - Comprehension: `correct/5` as %.
   - **Effective WPM** = `Math.round(wpm × correct/5)` — explained in one line.
   - Band label + one-sentence meaning (see bands).
   - "vs average adult": `((wpm/238) − 1) × 100` → "+31% faster than the
     average adult (238 wpm)" or "−12% slower…". Benchmark pinned in UI
     ("Benchmark: Brysbaert 2019, non-fiction, adults").
   - SVG arc gauge 0–800 wpm with band ticks (signature element).
   - Fun equivalents at *your* speed (3 lines): a 300-page novel (~90,000
     words), the whole Harry Potter series (1,084,170 words), War and Peace
     (~587,000 words). Show hours/minutes.
   - Flags: if wpm > 1200 → "That's skimming territory — a human reading
     every word rarely exceeds ~600 wpm." If correct ≤ 2 → "Low comprehension:
     try a slightly slower pass." If ms < 5s → treat as invalid, ask to retry.
   - Actions: **Share my score** (Web Share API if available, else copy link),
     **Copy link**, **Download result card** (PNG via `<canvas>`, 1200×630,
     drawn client-side, no deps), **Try another passage**, **Read it again**.
5. Challenge landing: when URL has `?p=<id>&wpm=<n>&c=<0-5>` show a banner
   above the tool: "Someone read this passage at **312 wpm** with 4/5
   comprehension. Can you beat it?" Button text becomes **"Beat this score"**.
   Same passage is forced. After the result, show "You beat it / they beat
   you" line. Never auto-scroll on load.

## Share payload
`?p=<passageId>&wpm=<int>&c=<0-5>` — nothing else, no names, nothing stored.
Share text: `I read at {wpm} words per minute with {pct}% comprehension. Beat
my score: {url}`. Copy-link uses `navigator.clipboard` with a textarea
fallback. Result-card PNG: site name, passage title, big WPM, comprehension,
band, URL. Draw with system fonts only.

## Data contract — `passages.js`
```js
// window.PASSAGES = [ {...}, ... ]  (also module.exports when present)
{
  id: "lighthouses",           // short, url-safe, stable (used in share links)
  title: "Why lighthouses blink",
  text: "Plain text, 230–290 words, ASCII punctuation, paragraphs split by \n\n",
  questions: [
    { q: "…", options: ["A","B","C","D"], answer: 2 }   // exactly 5 per passage, answer = index
  ]
}
```
Rules: 6 passages, ORIGINAL non-fiction written for this site (no copyrighted
text; no quotes longer than a few words), neutral, globally understandable,
Flesch-Kincaid roughly grade 8–10, factual claims safe/uncontroversial.
Questions test recall of content in the passage only; distractors plausible;
correct index varies (not always the same slot). Word count is computed at
runtime: `text.trim().split(/\s+/).length` — the engine never trusts a stored
count.

## Engine (`engine.js`, pure, no DOM; UMD tail for Node tests)
- `wordCount(text)`
- `wpm(words, ms)` → rounded int; returns 0 if ms ≤ 0
- `effectiveWpm(wpm, correct, total=5)`
- `band(wpm)` → `{key, label, note}`:
  - <150 "Developing" · 150–199 "Below average" · 200–299 "Average adult"
  - 300–399 "Above average" · 400–599 "Fast" · ≥600 "Very fast (check comprehension)"
- `vsAverage(wpm, benchmark=238)` → signed percent int
- `timeToRead(words, wpm)` → `{hours, minutes}`
- `encodeShare({p,wpm,c})` / `decodeShare(queryString)` (validates ranges,
  returns null on garbage)
- `isPlausible(ms, wpm)` → `{ok, reason}`

## Test cases (`test-cases.js`, runs under `node`, asserts against shipped bytes)
1. 250 words in 60,000 ms → 250 wpm; band "Average adult"; vsAverage +5
2. 250 words in 30,000 ms → 500 wpm; band "Fast"
3. 280 words in 120,000 ms → 140 wpm; band "Developing"; vsAverage −41
4. effectiveWpm(300, 4) → 240; effectiveWpm(300, 0) → 0
5. timeToRead(90000, 250) → 6 h 0 min; timeToRead(1084170, 238) → 75 h 55 min
6. encode/decode round trip; decode rejects `wpm=abc`, `c=9`, unknown `p`
7. wpm(words, 0) → 0; isPlausible(3000, 900).ok === false
8. Every passage: 230–290 words, exactly 5 questions, 4 options each, answer in 0–3
   Also: at least 15 assertions total.

## Keyword map
- Head (title/H1): "reading speed test" · secondary: "words per minute test", "wpm reading test"
- Title (<60): `Reading Speed Test — Free WPM Test With Comprehension`
- Meta (<155): `Find out how many words per minute you read, with a 5-question comprehension check. Free, instant, no sign-up. Share your score and challenge a friend.`
- H1: `Reading Speed Test: How Many Words Per Minute Do You Read?`
- H2s (verbatim long-tails): `How the reading speed test works` · `What is a good reading speed?` · `Average reading speed by age and level` · `How words per minute is calculated` (worked example) · `How to read faster without losing comprehension` · `Assumptions and limitations` · `FAQ`
- FAQ (5–6, verbatim in FAQPage JSON-LD): `What is the average reading speed for adults?` · `What is a good WPM score?` · `Is 300 words per minute fast?` · `Why does the test ask comprehension questions?` · `How accurate is an online reading speed test?` · `Is my result saved or sent anywhere?`

## Content facts to use (cite in-page)
- Brysbaert, M. (2019), *Journal of Memory and Language*: meta-analysis of 190
  studies; average silent reading rate for adults ≈ **238 wpm non-fiction**,
  **260 wpm fiction**, **183 wpm reading aloud**. Popular "300 wpm" figure is high.
- Speed above ~500–600 wpm with full comprehension is rare; higher numbers
  usually mean skimming. Comprehension check exists because speed alone is
  meaningless.
- Explainer 500–700 words total. Plain language. No medical/educational
  diagnosis claims; "this is a snapshot, not an assessment".

## Design identity — "reading lamp"
Warm cream paper `#faf6ee`, deep ink-green `#1f3d2b` as brand, tangerine
accent `#e07a2f` for the gauge needle and primary button, muted `#5c6660`.
System **serif** display (`Iowan Old Style, Palatino Linotype, "Book Antiqua",
Georgia, serif`) for H1/hero number; system sans for UI. Signature element: the
**SVG arc gauge** with a tangerine needle, plus a bookmark-ribbon tab on the
passage card. Dark mode via `prefers-color-scheme` (paper → `#14201a`).
Reading view: passage set at 1.15–1.2rem, ~62ch measure, 1.65 line-height.
Must not resemble siblings (navy dashboards / dark teal dev UI).
Mobile-first; tool above the fold at 360×640; 44px tap targets; visible focus;
`prefers-reduced-motion` respected (gauge needle animates only when allowed).

## Files
```
sites/reading-speed-test/
  index.html         critical CSS inline, JS at end of body (passages.js, engine.js, app.js)
  passages.js        data only
  engine.js          pure functions
  app.js             DOM wiring, timer, share, canvas card
  test-cases.js      node test-cases.js → exit 0
  assets/favicon.svg assets/og-image.jpg (1200×630, ≤60KB)
  robots.txt sitemap.xml
  about/index.html privacy/index.html   (short; privacy: no cookies, no tracking, no storage of results)
```
Optional progressive enhancement only: remember personal best in
`localStorage` behind try/catch; core flow must work with storage disabled.

## Monetization
Three empty `.ad-slot` divs: below result · mid-explainer · above footer.
Never between passage/quiz and result. No publisher IDs, no AdSense loader,
no ads.txt until the owner approves.

## Domain
**NOT SECURED.** Use the placeholder `https://readingspeedtest.example/` for
canonical, OG, robots and sitemap. Build notes must list the one-line
find-and-replace to swap it. Do not guess a real domain.

## Footer interlinks
autoloanpayment.com · subscriptioncreepcalculator.com · thestatisticslab.io

## Quality gates (PROJECT-RULES.md)
Lighthouse mobile ≥95 ×4 where measurable in-session · zero console errors ·
360px usable · keyboard end-to-end · page weight <200KB (target <80KB) ·
valid WebApplication + FAQPage JSON-LD · FAQ answers visible verbatim.

## Definition of done
All files above exist · `node sites/reading-speed-test/test-cases.js` passes ·
Playwright run of the full flow (start → done → 5 answers → result → share
link → challenge landing) with zero console errors · build-notes entry ·
README project list entry.
