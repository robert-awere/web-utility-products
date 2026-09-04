# Build notes

Append one entry per site: date, slug, Lighthouse scores, design signature, what to reuse or avoid.

---

## 2026-08-21 — p2-auto-loan

**Lighthouse (mobile, default Slow-4G simulation):** Performance 99 · SEO 100 · Accessibility 100 · Best Practices 100. LCP 1.3s, CLS 0, TBT 120ms; interactive 0.4s on regular 4G (10 Mbps / 40 ms RTT, 4× CPU). Page weight 48KB before ads.

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
