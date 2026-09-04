# SourceBrief

## Utility slug

sourcebrief

## Target path

sites/sourcebrief/

## Purpose

SourceBrief is a free GitHub repository briefing utility. A user enters a public GitHub repository URL or `owner/repo` value and receives a visual, decision-oriented briefing before reading the code.

## Positioning

Understand any GitHub repo before you read the code.

## Core features

- Accept a public GitHub repo URL or `owner/repo`.
- Fetch live public GitHub metadata where possible.
- Fall back to clearly labelled demo data if the public API is unavailable or rate-limited.
- Generate a repo summary, verdict, decision scorecard, setup guidance, architecture map, complexity view, risks, opportunities, AI prompt board, and evidence panel.
- Present the utility as free and public, with no paid-tier UI.

## Approved stack exception

PROJECT-RULES.md defaults utilities to static HTML, vanilla JavaScript, and CSS. For this utility, the owner explicitly approved importing the existing React/Express SourceBrief app.

## Monetization direction

SourceBrief is being repositioned away from subscription SaaS and toward a free public micro-utility that can later support tasteful AdSense monetization through useful, indexable repo briefing pages.

## Current limitations

- Public GitHub API only.
- No GitHub App private repo support.
- No persistent public repo result pages yet.
- No AdSense code or publisher credentials.
- No analytics or tracking.

## Next planned work

1. Rework homepage copy for the free public utility model.
2. Add shareable result URLs.
3. Create SEO-friendly repo briefing pages.
4. Add related repo discovery.
5. Add lightweight feedback capture.
6. Add AdSense-ready layout zones.
7. Add SEO safeguards.
