# CLAUDE.md — web-utility-products factory

Monorepo of single-purpose web utility sites (calculator.net class), each vastly better than the incumbent on one narrow tool. Revenue: Google AdSense + affiliate fallback. Owner: RobClawx (solo). This file is the standing law for every session.

## Repo structure

```
/sites/<slug>/          one folder per site, fully self-contained, independently deployable
  index.html            the entire tool (inline critical CSS, deferred JS)
  /assets/              images, favicon, og-image
  sitemap.xml, robots.txt
/specs/<slug>.md        the spec each site is built from — never build without one
/research/              market research (see aug2026-utility-list.md for the 41-concept list)
/shared/                boilerplate template + shared snippets; copy INTO a site folder, never import at runtime
/logs/build-notes.md    append what worked/failed per site (design tries, Lighthouse fixes)
```

Site slugs match spec IDs: `p2-auto-loan`, `p1-paycheck`, `s14-tdee`, etc.

## Stack — non-negotiable

- Static HTML + vanilla JS + CSS. No frameworks, no build step, no bundler, no server, no uploads. Everything computes client-side.
- One `index.html` per tool page; sub-pages (e.g., state variants) are separate static pages generated from the same template.
- No external JS dependencies except the AdSense snippet (when added) and one optional font via `<link>`. Self-host if font adds >50ms.
- No cookies, no localStorage requirements for core function, no tracking beyond a single analytics stub (Plausible/GA placeholder div, commented out until owner enables).

## Per-site pipeline (execute in order, gate before advancing)

1. **Spec** — read `/specs/<slug>.md`. If missing or ambiguous, stop and ask; do not invent scope.
2. **Build** — copy `/shared` boilerplate into `/sites/<slug>/`, implement calculator + content.
3. **Validate** — all gates below pass.
4. **Deploy (temp)** — push; Cloudflare Pages auto-deploys the folder to its `*.pages.dev` subdomain. Owner reviews live.
5. **Domain** — OWNER-ONLY: WHOIS check, purchase, DNS. Never assume the domain in the spec is secured.
6. **Index** — OWNER-ONLY: GSC verification + sitemap submit. Generate the sitemap/robots; owner submits.
7. **Monetize** — AdSense slots exist as empty, clearly-commented `<div class="ad-slot">` placeholders from day 1 (positions: below result, mid-explainer, footer). Owner inserts publisher code post-approval. Affiliate links (spec-defined) go live at launch so the site earns pre-approval.
8. **Log** — append a build-notes entry: date, slug, Lighthouse scores, design signature used, anything to reuse or avoid.

## Quality gates (block deploy if any fail)

- Lighthouse mobile ≥95 on Performance, SEO, Accessibility, Best Practices.
- Formula outputs spot-checked against the incumbent named in the spec (≥5 test cases, documented in a code comment).
- Valid JSON-LD (WebApplication or FAQPage + relevant type) — test with schema validator.
- Renders and is fully usable at 360px width; keyboard-operable; visible focus states; respects `prefers-reduced-motion`.
- Total page weight <200KB before ads; interactive <1s on simulated 4G.
- Zero console errors.

## SEO requirements (every site)

- Keyword map from the spec drives: `<title>` (head term, <60 chars), meta description (<155 chars), H1 (one only), H2s (long-tails), FAQ section (long-tail questions verbatim).
- 400–700 words of genuine explainer content below the tool: how the formula works, worked example, assumptions/limitations. Written for a human, not stuffed. This is an AdSense-approval and E-E-A-T requirement — never ship a naked tool.
- FAQ block (4–6 Qs) with FAQPage JSON-LD.
- YMYL sites (finance/health/legal): cite the formula source, add a plain-language disclaimer ("estimate, not advice"), show calculation assumptions openly.
- Canonical URL, OG tags, og-image per site.
- Internal links: every site footer links 2–3 sibling sites once they exist (hub effect).

## Design rules

- Each site gets its OWN identity — palette, type pairing, one signature element derived from the tool's subject matter (a loan tool can look like finance; a chemistry tool can look like a lab). Never reuse a previous site's look wholesale; never default to cream-background + serif + terracotta, or near-black + acid-green.
- Layout priority: tool above the fold, result prominent and instant (compute on input, no submit button where avoidable), explainer + FAQ below, ad slots never between input and result.
- Restraint: one memorable element, everything else quiet. Mobile-first.
- Copy: plain verbs, sentence case, active voice; buttons say what they do ("Calculate payment", not "Submit").

## Conventions

- Execution on explicit go-ahead only; owner may use "COMMENCE".
- Commits: `<slug>: <imperative summary>`. One site per PR/push batch.
- Never touch another site's folder while building a site unless updating footer interlinks.
- Never add a dependency, tracking script, or third-party embed not named in this file or the spec.
- Money/legal/health numbers: when tax brackets, rates, or state rules are involved, pin the data year in the UI (e.g., "2026 rates") and isolate the data in one clearly-marked JS object for easy annual updates.
