# BACKLOG — QUICK//AI

## NOW

- All five MVP tools shipped 2026-08-12: Task Router, Agent or Chat?, Model
  Downgrader, Cost Leak, Can AI Handle This?. Freshness now recomputed at load.

## NEXT

1. **Registry re-verification pass** against primary vendor docs (needs unblocked
   network). Fills the UNKNOWN GPT-5.6 context windows, promotes facts to FRESH.
   Value: trust.
2. **Deployment** — static hosting (the site is a pure static build). Needs the
   user's hosting decision.

## LATER

- Benchmark regression snapshot script (record previous vs new benchmark results on
  routing changes, per spec §14).
- Task-description intake improvements (multi-intent detection) — only with evidence
  that prefill misses are hurting recommendation quality.
- Latency/speed data per model with sources (currently an internal assessment).

## NOT BUILDING

- Accounts, payments, teams, dashboards, analytics suite, API marketplace (Phase-1
  gate; no recommendation-quality value).
- Programmatic SEO (blocked until routing quality is proven in the wild).
- Multi-model chat wrapper, prompt library, AI news/leaderboard features (out of scope
  by product definition).
- LLM-assisted routing (see DECISIONS D4 — deterministic wins until proven otherwise).
- Percentage scores (DECISIONS D1 — permanently out unless the scoring-safety
  conditions in the spec are all met).
