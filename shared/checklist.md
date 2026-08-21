# Pre-deploy checklist (CLAUDE.md quality gates)

Copy into the PR/commit notes and tick. Any unticked line blocks deploy.

## Gates
- [ ] Lighthouse mobile ≥95 — Performance, SEO, Accessibility, Best Practices
- [ ] Formula spot-checked against the incumbent named in the spec, ≥5 cases,
      documented in a code comment next to the math
- [ ] JSON-LD valid (WebApplication + FAQPage + any spec type)
- [ ] Usable at 360px width — no horizontal scroll, no clipped controls
- [ ] Keyboard operable end to end; visible focus on every interactive element
- [ ] `prefers-reduced-motion` respected
- [ ] Page weight <200KB before ads; interactive <1s on simulated 4G
- [ ] Zero console errors

## SEO
- [ ] `<title>` <60 chars, head term first
- [ ] Meta description <155 chars
- [ ] Exactly one `<h1>`; H2s carry the spec's long-tails
- [ ] 400–700 words of genuine explainer below the tool
- [ ] FAQ 4–6 Qs, matching the FAQPage JSON-LD verbatim
- [ ] Canonical + OG tags + og-image
- [ ] YMYL: formula source cited, assumptions shown, "estimate, not advice"
- [ ] Footer links 2–3 sibling sites
- [ ] sitemap.xml + robots.txt point at the real domain

## Monetization
- [ ] Three empty `.ad-slot` divs: below result · mid-explainer · above footer
- [ ] No ad slot between inputs and result
- [ ] Affiliate block present (placeholder `#` until the owner supplies the URL)

## Design
- [ ] Own palette + type pairing + one signature element from the subject matter
- [ ] Not a reuse of a previous site's look
- [ ] Tool above the fold; result instant, no submit button
- [ ] Data year pinned in the UI; rate data isolated in one marked JS object

## After deploy
- [ ] `/logs/build-notes.md` entry appended
