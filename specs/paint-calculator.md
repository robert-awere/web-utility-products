# Project Quantity specification

## Scope
Repository: robert-awere/web-utility-products. TARGET_SITE=sites/paint-calculator.
One site containing related calculator and guide pages. Satellite tools remain within this folder and existing deployment project, not separate sites. Preserve paint at / and flooring at /floor-calculator.html. No other site, DNS, domain or production configuration changes.

## Stack
Static HTML, vanilla JavaScript, CSS. Reuse existing visual styling and pure-calculation patterns. No new dependencies, framework, backend, tracking or build pipeline. Browser-local calculations.

## Article pilot
Research and write a practical wall-measurement guide for paint, including doors, windows and ceilings. Research primary/secondary keyword intent without invented volumes. Cite reliable sources; verify worked examples against real calculator behavior. Explain standard-opening defaults and tool limitations. Link only to verified live tools. Provide readable preview, metadata, internal links and sitemap entry. No invented author expertise.

## Review quality
Follow AGENTS.md and PROJECT-RULES.md: at least five formula tests; 360px usability; keyboard/focus accessibility; zero console errors; link/metadata checks; mobile Lighthouse target >=95 across categories. Pre-mortem functional/logical/textual/cosmetic failure modes, implement, test, inspect, fix and retest before Robert reviews. Check unit conversions, rounding boundaries, invalid/stale results, example consistency and affected existing-tool regressions. Report actual checks and limitations.

## Editorial and publication
One draft roughly every 48 hours; cap at three unpublished articles total including approved drafts. Revisions first. Verify tool live before drafting AND publishing; planned/local/preview tools do not qualify. Paint/floor articles only initially. Avoid duplicate topics/filler.
Separate GitHub PRs with readable preview and QA/source evidence. Robert explicitly approves in Telegram by PR link; approval recorded against exact commit and message reference. Changed commits do not automatically inherit approval; material changes require reapproval. No main push, merge or production deployment without approval. Article slots Wednesday 09:00 and Sunday 18:00 Europe/Paris, DST-aware; skip without approved eligible material. Tool release timing in same slots remains proposed.

## Operations
Verify project/root and review-branch preview isolation before pushing. Prevent overlaps, duplicate PRs/publications and blind retries. Stop affected workflow and notify on failed tests, ambiguous approval or deployment problems. Verify rollback route before release. Prove this article pilot review workflow before unattended automation. This spec activates no cron and authorises no production release or AdSense submission.
