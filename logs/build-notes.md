# Build notes

Append one entry per site: date, slug, Lighthouse scores, design signature, what to reuse or avoid.

---

## 2026-11-04 — reading-speed-test

**Lighthouse (mobile, Lighthouse 13.6.0, headless Chromium 1243, served from a local static server):** Performance 100 · SEO 100 · Accessibility 100 · Best Practices 100. LCP 1.4s, TBT 0ms, CLS 0.000 (root) / 0.002 (`?p=pigeons`, the longest passage title). Page weight 79.3KB before ads (index.html + passages.js + engine.js + app.js + favicon), og-image.jpg 54KB (1200×630, JPEG q70).

**Validation:** `node sites/reading-speed-test/test-cases.js` → 35 passed, 0 failed, exit 0 against the shipped `engine.js` + `passages.js` (spec cases 1–8, band boundaries, share-link encode/decode rejection, passage data contract for all six ids). Playwright (Chromium, http server, not file://) at 360×640 and 1280×800: 100 checks, 0 failures — zero console errors and zero failed requests on `/`, `/about/`, `/privacy/`; `scrollWidth` ≤ viewport at idle, result and with FAQ open; Start button fully inside the 360×640 fold (top 551, bottom 609); full flow Start → 6s read → done → 5 answers → "Show my result" → result shows wpm, band label, 4/5, three equivalents, URL rewritten to `?p=&wpm=&c=`; fresh load of that share URL shows the challenge banner with the wpm, "Beat this score" button, Change passage hidden, scrollY 0, outcome line after the rematch; keyboard end to end (Tab×4 to Start, Enter starts, Space finishes, Space in the quiz radios, Enter on "Show my result", focus lands on the result heading); Space inside a text input does not end the read; <5s read refused with the retry panel and no share URL; garbage `?wpm=abc&c=9` shows no banner but still honours the `?p=`; `prefers-reduced-motion: reduce` sets the needle without transition; dark mode paper `rgb(20,32,26)`; every internal link on all three pages returns 200. Static: title 53 chars, meta 151 (about 153, privacy 148), exactly one h1 per page, both JSON-LD blocks parse (WebApplication + FAQPage), all six FAQ names and answers appear verbatim in visible text, explainer 692 visible words, passages 100% ASCII, no ad slot inside the tool section.

**Design signature:** "reading lamp" — cream paper, ink-green serif display, one tangerine accent carried by the SVG arc gauge needle (0–800 wpm, band ticks), the bookmark ribbon on the passage card, the primary button and the FAQ toggles. System fonts only. Passage text is never in the DOM before Start (blurred decoy lines), so it cannot be peeked or copied, and it is removed again when the quiz begins. The canvas result card reuses the same gauge geometry as the SVG.

**What worked, reuse:**
- Three parallel roles (engine/UI, content, integrator) against one spec with named HTML markers (`<!-- FAQ-JSONLD -->`, `EXPLAINER:START/END`) merged cleanly in one pass; the content agent shipping its fragment with the FAQPage JSON-LD generated from the same array as the visible `<details>` meant the verbatim check passed first time.
- `test-cases.js` accepting either `module.exports = [...]` or `{PASSAGES}` and asserting the id regex the share-link validator uses, so a bad passage id would fail in Node before it broke a share link.
- `decodeShare` returning `{p, wpm:null, c:null}` for a bare `?p=` keeps "pick this passage" links and challenge links on one code path.
- Screenshotting a 1200×630 HTML card with Playwright is the quickest way to an og-image that matches the page palette exactly; JPEG q80 was 64.7KB (over the 60KB cap), q70 is 54KB with no visible loss.

**What bit, avoid:**
- CLS from JS-set text: the passage title is written after first paint and a two-line title ("How carrier pigeons found their way home") pushed the Start button down for a 0.085 shift and Performance 98 on some loads, invisible on short-title loads. Fixed by reserving two title lines (`min-height:2.3em`) below 720px. Any element whose text is filled by JS above the fold needs a reserved height.
- The fold at 360×640 is tight: with the real passages (longer titles than the stub) the Start button overflowed by 17px. Trimmed the lede, dropped one decoy line and 0.04rem of lede size under 420px.
- The sibling pages' meta descriptions arrived at 166 and 178 chars; trimmed to 153 and 148. Check every page's meta length, not just the main one.
- Chrome reports a 0.01ms transition as `1e-05s` in `getComputedStyle`, which tripped a string compare in the first QA pass.

**Known limitations:** one short passage is a small sample; the 238 wpm benchmark is adult non-fiction (Brysbaert 2019) and no age/grade norms are shown; Web Share API path not exercised headlessly (clipboard fallback verified); the optional personal best uses `localStorage` behind try/catch (stated on the privacy page; delete `updatePersonalBest()` in `app.js` for zero storage); passages read at roughly Flesch-Kincaid grade 7–8 by a crude estimator, slightly under the spec's 8–10.

**Open items for owner:**
- Domain not secured. Placeholder `https://readingspeedtest.example/` is in canonical, OG, twitter image, both JSON-LD blocks, robots.txt, sitemap.xml and the about/privacy pages. One-line swap once the domain exists: `grep -rl 'readingspeedtest.example' sites/reading-speed-test | xargs sed -i 's#https://readingspeedtest.example/#https://REAL-DOMAIN/#g'`
- Create the Vercel project with Root Directory `sites/reading-speed-test`, Framework Preset Other, no build command, no output directory override.
- AdSense: paste the loader where the `<head>` comment marks it and the units into the three `.ad-slot` divs (`below-result`, `mid-explainer`, `above-footer`). No publisher IDs or ads.txt shipped.
- Sibling footers (autoloanpayment.com, subscriptioncreepcalculator.com, thestatisticslab.io) do not yet link back to this site.
- Not committed or deployed: the site directory and `specs/reading-speed-test.md` are untracked in the working tree.

---

## 2026-08-21 — p2-auto-loan

**Lighthouse (mobile, default Slow-4G simulation):** Performance 99 · SEO 100 · Accessibility 100 · Best Practices 100. LCP 1.3s, CLS 0, TBT 120ms; interactive 0.4s on regular 4G (10 Mbps / 40 ms RTT, 4× CPU). Page weight 48KB before ads.

**2026-09-05 Third guide + two fixes:** Added `sites/sourcebrief/guides/ai-prompts-understand-codebase/` (~1,300 words: what to give an assistant before asking, six prompts in sequence, prompts that waste time, and how to spot an invented answer). Linked from the hub, the homepage AI-prompts section, and guide two. New CSS: `.prompt-block`. Sitemap now carries 12 URLs.

Two pre-existing bugs found while building it. First, the FAQPage JSON-LD on both earlier guides described answers that appeared nowhere in the visible page, which Google's FAQ structured-data policy requires; each guide now has a visible "Common questions" section mirroring its schema, and a check confirms every schema answer is present as visible text on all four pages carrying FAQ markup. Second, the dark palette was only ever applied by the JS toggle in `app.js`, which only the homepage loads, so every sub-page was locked to light regardless of OS setting; added a `@media (prefers-color-scheme: dark)` block scoped to `:root:not([data-theme])` so the system preference applies everywhere while the homepage toggle still wins once it sets an explicit theme.

**2026-09-05 FAQ realignment:** Rewrote the homepage FAQ and its FAQPage JSON-LD together from a single source so the two cannot drift, since Google requires schema answers to appear in visible page content. Dropped "Why are a lot of people leaving GitHub?" (off-intent, and the keyword brief recommended demoting the GitHub-alternatives cluster), "What is repository name in GitHub?" (definitional, dominated by GitHub's own docs; the term is still covered in prose in `#repo-info`), and "Why make it static?" (developer-facing, not user-facing). Added safety, maintenance and comprehension questions matching the P1 evaluation-intent terms, plus "What does SourceBrief actually check?". Two answers now link to the guides. New CSS: `details p a`, because inline links in answers inherited the muted answer colour and were indistinguishable from body text.

**2026-09-05 Second guide + guides hub:** Added `sites/sourcebrief/guides/understand-github-repository/` (~1,100 words on a reading order for unfamiliar repos: README, manifest, folder names, entry point, tests, history) and `sites/sourcebrief/guides/index.html` as the `/guides/` hub with CollectionPage + ItemList schema. Now that the hub exists, the intermediate "Guides" crumb was restored to the safety-checklist breadcrumb and its JSON-LD. Cross-links added both ways between the two guides, from the homepage `#repo-info` section, and a Guides entry added to the footer of every page. New CSS: `.guide-index`. Sitemap now carries 11 URLs.

**2026-09-05 First guide page:** Added `sites/sourcebrief/guides/github-repo-safety-checklist/` — a ~1,150-word checklist targeting the "how to know if a github repo is safe" cluster, the highest-priority term in the keyword brief. Reuses the existing `.legal-page` / `.legal-content` prose shell rather than a new template, carries Article, BreadcrumbList and FAQPage JSON-LD, and links out to GitHub, npm, OpenSSF and Choose a License docs. Linked from the homepage `#repo-safety` section and added to the sitemap. New CSS: `.section-followup`, `.breadcrumb`. Note the breadcrumb needed explicit `display` overrides because the global `nav a { display: none }` mobile rule and `nav { display: inline-flex }` otherwise hide and shrink-wrap it.

**2026-09-04 SEO heading update:** Rewrote the SourceBrief homepage around evaluation intent rather than definitional intent. New H1 is "GitHub Repo Analyzer — Understand and Vet Any Public Repo in Seconds", with intent-led H2 sections: "How to Understand a GitHub Repository Fast", "Is This GitHub Repo Safe?", "Is It Still Maintained?", "Setup Clues: What It Takes to Run This Project Locally", and "AI Prompts to Ask About This Repo". Title/description/OG metadata were realigned to the analyzer positioning, primary nav gained Safety and Setup anchors, and a `.hero-copy h1` rule was added because the default 12ch display measure wrapped the longer headline into six lines and pushed the scanner form below the fold. Source: the SEO keyword research brief, which found the evaluation-intent cluster winnable and the definitional cluster dominated by GitHub's own docs.

**Design signature:** "night dashboard" — deep indigo instrument-cluster result panel, amber needle-tick under the hero payment, road center-line divider (`hr.road`, repeating amber dashes on navy), tabular-numeral odometer digits. System font stack only (zero font requests).

**What worked, reuse:**
- Engine/DOM split (`calculator.js` pure math + `app.js` wiring) with a UMD-ish tail (`module.exports` when present) lets the *shipped* file run under Node — `test-cases.js` runs 54 assertions against the exact bytes deployed, no build step.
- Independent verification trick: solve for the payment by bisection on the raw balance recursion and compare to the closed form (matched to 6 decimals on 8 cases). Worth repeating on every finance site where the incumbent can't be fetched from the build environment.
- Building the state `<select>` from the data object at runtime keeps dropdown and tax table from drifting.
- Amortization as `<details>` per year (12-row tables in an `overflow-x:auto` scroller) is genuinely usable at 360px.
- Rounding convention: bill the cents-rounded payment, absorb the remainder in the final payment, cap the row loop at `months`. First draft produced a 61st payment on a 60-month loan — the reconciliation asserts (Σprincipal = P, Σinterest = total) caught it. Keep those asserts in every loan tool.

**What bit, avoid:**
- A generic `.prose p { color }` rule silently overrode the formula block's light-on-dark text → the only Lighthouse a11y failure (contrast 1.23). Scope prose color rules or they'll eat any dark inset block.
- calculator.net (and google.com) are blocked by the build proxy — live incumbent comparison must happen from the owner's machine; the numeric-solver check above is the in-session substitute.
- og-image as PNG of a gradient was 211KB; same frame as JPEG q82 is 44KB.

**Deployed:** merged to main (PR #3) and live on Vercel (own project, Root Directory `sites/p2-auto-loan`, no build command).

**Domain:** autoloanpayment.com purchased 2026-08-21 (Hostinger); canonical/OG/robots/sitemap swapped to .com.

**Open items for owner:** attach autoloanpayment.com in the Vercel project (Settings → Domains) + Hostinger DNS, GSC + sitemap submit, affiliate URL for the "Compare current auto loan rates" block, AdSense units into the three `.ad-slot` divs. Sibling sites' footers not yet updated to link back here (do together with next interlink pass).

---

## 2026-09-04 — sourcebrief

**Validation:** Imported existing React/Express SourceBrief app into `sites/sourcebrief/` after owner approval for a stack exception. Ran `npm ci` and `npm run build` from `sites/sourcebrief`; production build passed. npm reported 9 dependency audit findings (4 low, 1 moderate, 4 high); no automatic dependency fixes were applied.

**2026-09-04 static cleanup update:** Converted SourceBrief to the repository-standard static utility model: `index.html`, `styles.css`, `app.js`, `robots.txt`, `sitemap.xml`, and SVG assets only. Removed React, Express, Vite, Tailwind, TypeScript, shadcn UI, package manifests, lockfile, server files, and build scripts from `sites/sourcebrief/`. `node --check app.js` passed. There is no remaining npm manifest or lockfile, so the previous npm audit surface has been removed rather than patched.

**2026-09-04 domain SEO update:** Production domain confirmed as `https://www.sourcebrief.io/` with apex redirecting to `www`. Canonical URL, Open Graph URL, robots sitemap pointer, and sitemap `<loc>` were updated to the production `www` URL.

**2026-09-04 homepage SEO copy update:** Reworked the SourceBrief homepage around practical repo-intent queries: GitHub repo info, GitHub repo description, GitHub repository search, repository-name format, how to get repo info, whether a GitHub repo is safe, and why some developers evaluate GitHub alternatives. Added visible explainer content and FAQPage JSON-LD while keeping the scanner above the fold.

**2026-09-04 shareable result URL update:** Completed the shareable-result MVP. Successful scans now push a `?repo=owner/repo` URL, copied result links can be opened directly by another user, direct `?repo=` visits auto-run the public repo briefing, browser back/forward is handled, and the result header includes a copy-link action.

**2026-09-04 SEO repo page structure update:** Added clean `/repo/{owner}/{repo}/` route structure for SourceBrief repo briefings, while preserving legacy `?repo=owner/repo` links as fallbacks. Added Vercel rewrites for static direct links, repo-specific dynamic metadata/TechArticle JSON-LD after successful scans, homepage example repo links, and curated sitemap seed URLs for `facebook/react`, `vercel/next.js`, and `microsoft/vscode`.

**2026-09-04 feedback capture update:** Added a result-level feedback panel that lets visitors classify a brief as useful, confusing, missing information, or bugged, then open a prefilled public GitHub issue or copy the feedback text. This keeps feedback collection transparent and static-site friendly: no cookies, no analytics, no background form submission, and no new dependencies.

**2026-09-04 related repos update:** Added a related repositories panel to each SourceBrief result. It uses public GitHub search signals from topics, language, repo name, and description, excludes the currently scanned repo, and links related items to SourceBrief `/repo/{owner}/{repo}/` pages first so visitors can continue comparing repos inside the utility.

**2026-09-04 AdSense placeholder update:** Added inactive, AdSense-ready layout zones without inserting Google scripts, publisher credentials, tracking code, or live ad requests. Placements sit after the generated related-repo value and below the educational example section, preserving an ad-free scanner and primary result flow.

**2026-09-04 SEO safeguards update:** Added an explicit robots meta tag and a curated indexability allowlist for repo pages. The homepage and sitemap-listed examples remain `index,follow`; arbitrary generated repo pages become `noindex,follow` after the client-side repo brief loads. Also disallowed legacy `?repo=` URLs in `robots.txt` and documented that `sitemap.xml` must remain curated/manual until a generator policy is chosen.

**2026-09-04 trust pages update:** Added static About, Privacy, Terms, and Contact pages for SourceBrief, linked from the site footer and sitemap. The pages clarify that the tool uses public GitHub repo data only, does not require accounts or private repo access, has inactive ad placeholders only, and routes feedback through public GitHub issues.

**Design signature:** dark developer-utility interface with teal action accents, visual repo briefing hero, verdict-first dashboard, scorecard, setup guidance, architecture map, module map, risk heatmap, prompt board and evidence panel.

**What worked, reuse:**
- Public GitHub REST API integration gives live metadata, README, repository tree and manifest-derived stack signals without requiring authentication.
- The repo verdict and scorecard make the tool more decision-oriented than a generic repository summarizer.
- Pricing/SaaS UI was removed for the pivot toward a free public micro-utility and future AdSense-backed repo explainer library.

**Known limitations:**
- Public GitHub API rate limits still apply because the static site calls GitHub directly from the browser.
- Shareable URLs use `/repo/{owner}/{repo}/` and auto-run client-side; there are no fully pre-rendered static repo pages yet.
- AdSense zones are placeholders only; no publisher credentials, live ad script, or ad request is present.
- Feedback capture opens a prefilled public GitHub issue; SourceBrief does not store feedback itself.
- Related repo discovery is best-effort and can be unavailable when GitHub search is rate-limited or the scanned repo has weak metadata.
- Sitemap updates are currently static/manual and tied to the curated indexability allowlist. Before final launch, choose either curated sitemap entries or a generator script; do not automatically index every user-generated repo page.

**Next planned work:** consider a static generation strategy for curated popular repositories and decide whether an optional GitHub token flow is needed if rate limits become a real user problem.
