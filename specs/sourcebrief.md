# SourceBrief

## Utility slug

sourcebrief

## Target path

sites/sourcebrief/

## Production URL

https://www.sourcebrief.io/

## Purpose

SourceBrief is a free GitHub repository briefing utility. A user enters a public GitHub repository URL or `owner/repo` value and receives a visual, decision-oriented briefing before reading the code.

## Positioning

Get GitHub repo info before you read the code.

## Core features

- Accept a public GitHub repo URL or `owner/repo`.
- Fetch live public GitHub metadata where possible.
- Fall back to clearly labelled demo data if the public API is unavailable or rate-limited.
- Generate a repo summary, verdict, decision scorecard, setup guidance, architecture map, complexity view, risks, opportunities, AI prompt board, and evidence panel.
- Present the utility as free and public, with no paid-tier UI.
- Explain core search-intent questions on the homepage, including what a GitHub repo is, what a repository name means, how to get GitHub repo info, and whether a repo is safe enough to evaluate.
- Generate clean shareable result URLs at `/repo/{owner}/{repo}/`. Opening one of these URLs automatically re-runs the public repo briefing in the browser.
- Preserve legacy `?repo=owner/repo` links as fallbacks and canonicalize successful scans to the clean `/repo/.../` structure.
- Update repo-specific title, description, canonical URL, Open Graph URL, and structured data after a successful briefing.
- Show related public GitHub repos as follow-on SourceBrief scans so visitors can compare nearby projects.
- Capture lightweight visitor feedback through a prefilled public GitHub issue flow with copy fallback, without cookies, tracking, or background submission.
- Reserve non-live AdSense-ready layout zones below the primary repo value, without inserting publisher credentials, live ad scripts, or tracking code.

## Stack

Static HTML, vanilla JavaScript, and CSS.

SourceBrief was initially imported as a React/Express app with explicit owner approval, then converted to the repository-standard static utility model to reduce dependency risk, simplify deployment, and align with the broader micro-utility portfolio.

## Monetization direction

SourceBrief is being repositioned away from subscription SaaS and toward a free public micro-utility that can later support tasteful AdSense monetization through useful, indexable repo briefing pages.

## Current limitations

- Public GitHub API only.
- No GitHub App private repo support.
- Shareable result URLs use `/repo/{owner}/{repo}/` and auto-run in the browser. They are structured for SEO but are not fully pre-rendered static repo pages yet.
- AdSense layout zones are placeholders only. No AdSense code, publisher credentials, live ad requests, or tracking scripts are present.
- No analytics or tracking.
- Feedback capture requires the visitor to choose whether to submit a public GitHub issue; SourceBrief does not store feedback itself.
- Related repo discovery is best-effort and depends on the public GitHub search API, so it may be unavailable under rate limits or weak repo metadata.
- Browser-side GitHub API calls are subject to unauthenticated GitHub rate limits.
- Sitemap updates are static/manual for now. Before final launch, SourceBrief needs an explicit sitemap policy that uses curated repo pages or a generation script rather than automatically indexing every user-generated repo URL.

## Next planned work

1. Add a static generation strategy for curated popular repositories if SEO traction justifies it.
2. Add stronger index/noindex safeguards for arbitrary user-generated repo pages.
3. Consider an optional GitHub token flow only if rate limits become a real user problem.
