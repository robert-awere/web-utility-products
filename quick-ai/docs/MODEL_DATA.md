# MODEL DATA — sources, verification, freshness

Registry: `src/data/registry.ts`. Freshness rules: FRESH ≤30 days from verification,
AGING ≤120 days, STALE beyond; facts verified only against secondary sources are
**capped at AGING** (see DECISIONS D3). Facts we could not verify are **UNKNOWN**,
never guessed.

Data-entry date for the table below: **2026-08-12**.

| Model | Facts | Source | Verified | Freshness | Known uncertainty |
|---|---|---|---|---|---|
| Claude Fable 5 | $10/$50 per MTok, 1M ctx, vision+PDF | Anthropic docs snapshot (platform.claude.com) | 2026-06-24 | AGING | none noted |
| Claude Opus 5 | $5/$25, 1M ctx, vision+PDF | Anthropic docs snapshot | 2026-06-24 | AGING | none noted |
| Claude Sonnet 5 | $3/$15 ($2/$10 intro to 2026-08-31), 1M ctx | Anthropic docs snapshot | 2026-06-24 | AGING | intro pricing expires 2026-08-31 |
| Claude Haiku 4.5 | $1/$5, 200K ctx | Anthropic docs snapshot | 2026-06-24 | AGING | none noted |
| GPT-5.6 Sol | $5/$30 | pricepertoken.com, benchlm.ai, aipricing.guru | 2026-08-12 | AGING (secondary cap) | context window UNKNOWN |
| GPT-5.6 Terra | $2/$12 (20% cut 2026-07-30) | same | 2026-08-12 | AGING (secondary cap) | context window UNKNOWN |
| GPT-5.6 Luna | $0.20/$1.20 (80% cut 2026-07-30) | same | 2026-08-12 | AGING (secondary cap) | context window UNKNOWN |
| Gemini 3.1 Pro | $2/$12 (≤200K prompt), 1M ctx | pricepertoken.com, curlscape.com, benchlm.ai | 2026-08-12 | AGING (secondary cap) | tiered pricing above 200K not modeled |
| Gemini 3.6 Flash | $1.50/$7.50, 1M ctx | same | 2026-08-12 | AGING (secondary cap) | — |
| Gemini 3.5 Flash-Lite | $0.30/$2.50, 1M ctx | same | 2026-08-12 | AGING (secondary cap) | — |
| Open-weights self-hosted | pricing n/a, ~128K ctx typical | typical-config estimate | 2026-08-12 | UNKNOWN/AGING | varies enormously by model + serving stack |

## Verification debt

- Primary docs for OpenAI (`platform.openai.com`), Google (`ai.google.dev`), and
  Anthropic (`docs.anthropic.com`) are blocked by the build environment's egress
  proxy. First action when unblocked: re-verify all pricing/context facts against
  primary pages, promote to FRESH, and fill the UNKNOWN context windows.
- Capability tiers are **internal assessments** (method + rationale + review date on
  each entry), reviewed 2026-08-12. Review again on any major model release.

## Update procedure

1. Verify the fact against a primary source; record URL and date.
2. Update value + `verified` + `freshness` in `src/data/registry.ts` and this table.
3. Run `npm test` — the benchmark suite asserts behavior, and a legitimate data change
   that flips a winner must be reviewed under the regression rule (spec §14) before merge.
