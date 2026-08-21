# /shared — site boilerplate

Copy-in boilerplate for every site in this factory. **Nothing here is imported at
runtime.** Each site is fully self-contained: you copy these files *into*
`/sites/<slug>/`, then edit them in place. If you change something here later, it
does not propagate — that is deliberate (a site that shipped keeps shipping).

## How to use it

```sh
cp -r shared/template/. sites/<slug>/
# then: fill every {{PLACEHOLDER}} in index.html, robots.txt, sitemap.xml
```

Then work through `checklist.md` before deploying.

## What's here

| Path | What it is |
|---|---|
| `template/index.html` | The page skeleton: head/meta/JSON-LD, tool → result → ad slot → explainer → FAQ → footer, base CSS tokens, calculator JS scaffold. Every site-specific value is a `{{PLACEHOLDER}}`. |
| `template/robots.txt` | Two-line robots + sitemap pointer. |
| `template/sitemap.xml` | Single-URL sitemap; add sub-pages as they exist. |
| `template/assets/` | Where `favicon.svg`, `og-image.png` (1200×630) live. |
| `snippets/ad-slots.html` | The three AdSense placeholder positions + the AdSense loader, commented out. |
| `snippets/analytics-stub.html` | Plausible/GA stub, commented out until the owner enables it. |
| `snippets/json-ld.html` | WebApplication + FAQPage blocks to fill in. |
| `snippets/footer-interlinks.html` | Sibling-site footer links (the hub effect). |
| `checklist.md` | The CLAUDE.md quality gates as a tick-list. |

## Placeholders in `template/index.html`

`{{SITE_NAME}}` `{{TITLE}}` `{{META_DESCRIPTION}}` `{{CANONICAL_URL}}` `{{DOMAIN}}`
`{{OG_TITLE}}` `{{OG_DESCRIPTION}}` `{{THEME_COLOR}}` `{{H1}}` `{{LEDE}}`
`{{APPLICATION_CATEGORY}}` `{{DATA_YEAR}}` `{{LASTMOD}}`

## Rules that survive the copy

- No frameworks, no build step, no runtime dependency other than the AdSense
  snippet and at most one `<link>` font.
- Critical CSS inline in `<head>`; JS at the end of `<body>`, deferred.
- Ad slots exist from day one as empty commented `<div class="ad-slot">` — never
  between the inputs and the result.
- Compute on input. No submit button where avoidable.
- 400–700 words of real explainer + a 4–6 question FAQ below the tool.
