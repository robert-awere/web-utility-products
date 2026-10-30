# Low-Competition Tool Keywords — October 2026

Research into checker / solver / converter / generator / calculator / remover queries where search demand exists but page one is weak. This follows on from `aug2026-utility-list.md`, which covered head terms; this file covers gaps in the long tail.

## Method and limits

- There was no paid keyword-tool access in this session. Google Autocomplete, DuckDuckGo suggest and risingtrends.co were all blocked by the sandbox network policy.
- So competition here means SERP composition: who actually ranks for the exact query. Every query was checked by live search on 2026-10-30.
- A query counts as "weak" when page one is mostly one of these:
  - forum posts, blog write-ups, PyPI/npm/GitHub pages or Chrome-extension listings, with no working web tool;
  - daily "answer" articles instead of tools;
  - scraped or spam pages, which signal Google has nothing good to rank;
  - many small, low-authority programmatic sites, with no dominant brand.
- Volume figures are given only where a source published them (Rising Trends data as of August 2026, quoted via search snippets). All other volumes are unverified.
- Before building, check each pick in Keyword Planner, Ahrefs or Semrush: target KD ≤ 20–30 and at least 3 weak results in the top 10.

## Tier 1 — build candidates

| # | Keyword cluster | Modifier | Demand signal | SERP weakness (observed) | Client-side? | RPM | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | nyt pips solver, pips puzzle solver, pips solver today | solver | NYT launched Pips in Aug 2025; daily-habit game; large hint-article ecosystem (Tom's Guide, FandomWire) | #1 is a blog post about MiniZinc (righto.com); rest are daily-answer articles. **No dedicated web solver ranks.** | Yes (constraint search / backtracking in JS) | Low–med | Strongest pure-SEO gap found |
| 2 | linkedin queens solver, tango solver, zip solver, linkedin games solver | solver | LinkedIn games run daily; FandomWire publishes daily solution posts, which proves demand | Page one is PyPI, Chrome-extension audit pages, itch.io and answer posts. **No web tool.** | Yes (user enters or pastes the grid; no automation, which avoids LinkedIn ToS issues) | Med (professional audience) | Strong; one site with 3–6 solver pages |
| 3 | c2pa checker, content credentials checker, check if image is ai generated, ai image metadata checker | checker | "ai image detector" ≈110K/mo, +232% YoY (Rising Trends via snippet) | Long-tail SERP: Sightengine vendor page, small tools, PyPI, c2paviewer. The head term is crowded; the provenance long tail is not. | Yes (C2PA/EXIF/XMP/IPTC parse in browser) | Med | Strong; honest "what survives, what doesn't" positioning |
| 4 | ai text cleaner, remove invisible characters, em dash remover, remove ai watermark text | remover / cleaner | "ai text cleaner" 20 → 3,600/mo (+17,900% over 2 years); "remove ai watermark" +4,650% over 2 years (Rising Trends) | Small tools only (convertcase, tooljunction, everychar, undsh). No authority brand. | Yes (trivial) | Low–med | Strong on trajectory; cheap to build; volatile trend |
| 5 | agents.md generator, claude.md generator, cursor rules generator, .cursorrules generator | generator | Agent-config files are now standard practice across Claude Code, Cursor and Codex | **Almost no dedicated tool ranks.** Results are comparison blog posts and one VS Code extension. | Yes (form → markdown) | Med–high (dev/SaaS advertisers) | Strong early mover; volume small but growing |
| 6 | [N] grams [ingredient] to cups (e.g. "200g flour to cups", "250 grams butter in cups") | converter | Evergreen cooking queries with huge combinatorial long tail | Scraped/spam pages (hijacked .edu subdomains, garbled "400 G To Cups") rank, so **Google is short of good answers** | Yes (density table) | Low–med (food) | Strong programmatic play; publish ≤30 pages/week to avoid crawl throttling |

## Tier 2 — viable, more crowded or narrower

| # | Keyword cluster | Modifier | Notes | Verdict |
|---|---|---|---|---|
| 7 | car loan interest deduction calculator, no tax on overtime calculator, no tax on tips calculator, senior deduction calculator, trump account calculator | calculator | 2025 tax-law (OBBBA) provisions, 2025–2028 tax years. Page one is full of small programmatic finance sites (fedratecalc, hacecuentas, richify, statecalc, levyio) plus TurboTax/Bankrate. Low authority but many rivals. Very high finance RPM. The window is the **Jan–Apr 2027 filing season**. | Best fit is **adding the car-loan-interest-deduction calculator to `sites/p2-auto-loan`** (needs owner approval) rather than a new site |
| 8 | nyt strands solver, spelling bee solver, letter boxed solver | solver | Spelling Bee has established solvers (dCode, Sportskeeda, sbsolver). Strands and Letter Boxed SERPs are weak (a chatbot page ranks for Strands). | Bundle with #1 as a "NYT puzzle solvers" site |
| 9 | uuid v7 generator, uuidv7 decoder, extract timestamp from uuid | generator / decoder | Only about 3 tools plus library docs (hexdocs) rank. RFC 9562 adoption is rising. | Easy win, low RPM; good as one page on a dev-tools site |
| 10 | jxl to jpg, jpeg xl converter, jxl to png | converter | Cloudinary, ezgif and small sites. Browser-local WASM is a privacy differentiator. | Moderate; low RPM |
| 11 | landed cost calculator, import duty calculator after de minimis | calculator | The US $800 de minimis exemption is fully suspended (2026). Sources disagree even on dates, so the information gap is real. Vendor SERPs. HTS data is heavy to maintain. | High RPM but high build and maintenance cost |

## Avoid (saturated despite looking niche)

- **llms.txt generator/validator.** 15+ tools already rank, including Chrome extensions and Apify.
- **"ai detector" / "ai checker" head terms.** About 2.24M and 1.5M/mo, but GPTZero, Originality, QuillBot and others own them. "ai checker" is −45% over 3 months.
- **EAA / accessibility checker.** BrowserStack, AudioEye and Recite Me are spending heavily on it, and free scans are lead-gen.
- **Generic QR, password, unit and age tools.** Covered in the August list; head terms are dominated by incumbents.

## Recommended build order

1. **NYT/LinkedIn puzzle solvers** (#1, #2, #8) as one site with a page per game. Clearest empty SERPs, daily repeat traffic.
2. **AI text cleaner + C2PA image checker** (#3, #4) as one "AI content hygiene" site. Rising demand, fully client-side.
3. **Agent-file generator** (#5). Small but almost uncontested; overlaps with the `sourcebrief` audience.
4. **Car loan interest deduction calculator** (#7) inside `p2-auto-loan`, shipped before January 2027.
5. **Ingredient grams↔cups programmatic site** (#6). Slower burn, largest long-term page count.

## Sources

- AI text cleaner and watermark trend data: https://www.risingtrends.co/blog/ai-text-cleaner-trend
- AI trends volumes: https://www.risingtrends.co/trends/ai-trends-2026
- Pips SERP: https://www.righto.com/2025/10 , https://www.tomsguide.com/gaming/nyt-pips-today-hints-and-answers
- LinkedIn solver SERP: https://pypi.org/project/navid-linkedin-puzzle-solver/ , https://lelserslasers.itch.io/linkedin-solvers
- C2PA tools: https://sightengine.com/c2pa-check , https://c2paviewer.com/articles/verify-ai-generated-image-c2pa-synthid
- Text cleaners: https://convertcase.net/em-dash-remover/ , https://www.tooljunction.io/tools/ai-text-cleaner
- Agent-file generators: https://github.com/devloadout/vscode-agent-rules
- Grams-to-cups SERP: https://www.gigacalculator.com/converters/convert-grams-to-cups.php
- OBBBA calculators: https://fedratecalc.com/car-loan-interest-deduction-calculator/ , https://hacecuentas.com/en/car-loan-interest-deduction-calculator , https://www.clockspot.com/tools/no-tax-on-overtime-calculator , https://www.omnicalculator.com/finance/trumps-account
- UUIDv7: https://www.authgear.com/tools/uuidv7-generator/
- JXL: https://localconvert.it.com/convert/jxl-to-jpg
- De minimis: https://www.freightfigures.com/articles/de-minimis-exemption-suspended-2026
- llms.txt saturation: https://chatthing.ai/tools/llms-txt-generator , https://fixaeo.com/llms-txt-validator/
- EAA checkers: https://www.browserstack.com/website-scanner/eaa-website-checker
- pSEO crawl pacing: https://thestacc.com/blog/programmatic-seo-case-study/
