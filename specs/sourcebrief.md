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
- Generate shareable result URLs with a `?repo=owner/repo` query parameter. Opening one of these URLs automatically re-runs the public repo briefing in the browser.

## Stack

Static HTML, vanilla JavaScript, and CSS.

SourceBrief was initially imported as a React/Express app with explicit owner approval, then converted to the repository-standard static utility model to reduce dependency risk, simplify deployment, and align with the broader micro-utility portfolio.

## Monetization direction

SourceBrief is being repositioned away from subscription SaaS and toward a free public micro-utility that can later support tasteful AdSense monetization through useful, indexable repo briefing pages.

## Current limitations

- Public GitHub API only.
- No GitHub App private repo support.
- Shareable result URLs use a `?repo=owner/repo` query parameter and auto-run in the browser. They are not pre-rendered public repo result pages yet.
- No AdSense code or publisher credentials.
- No analytics or tracking.
- Browser-side GitHub API calls are subject to unauthenticated GitHub rate limits.

## Next planned work

1. Add SEO-friendly repo briefing pages or a static generation strategy for popular repositories.
2. Add related repo discovery.
3. Add lightweight feedback capture.
4. Add AdSense-ready layout zones without interrupting input/result flow.
5. Add stronger result-page SEO safeguards and canonical/noindex strategy for query-driven pages.
6. Consider an optional GitHub token flow only if rate limits become a real user problem.
