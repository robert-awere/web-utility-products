# BACKLOG — QUICK//AI

## NOW

- (Phase 1 complete — nothing in flight.)

## NEXT (Phase 2, in order)

1. **Agent or Chat?** tool — pure classifier over `TaskProfile` (standard chat /
   reasoning chat / coding agent / research agent / browser agent / scheduled agent /
   workflow automation / multi-agent / traditional software / no AI). Reuses the
   no-AI gate and autonomy dimensions. Value: recommendation clarity.
2. **Model Downgrader** — input: current model + task profile; output: keep / drop a
   tier / small model / deterministic code / split workflow / route hard cases only.
   Reuses fit engine directly. Value: cost-efficiency.
3. **Registry re-verification pass** against primary vendor docs (needs unblocked
   network); recompute freshness at page load from verification dates instead of
   storing it statically. Value: trust.
4. **Cost Leak** tool — structured questionnaire over usage patterns → likely causes,
   severity, evidence, corrective actions. Value: cost-efficiency.
5. **Can AI Handle This?** — browser-side file inspection (size, format, token
   estimate, page count) before any recommendation. Value: trust + clarity.

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
