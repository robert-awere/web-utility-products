# DECISIONS — QUICK//AI

## D1 — Categorical fit levels, no numeric scores

- **Decision:** Fit is `BEST_FIT / STRONG / ACCEPTABLE / WEAK / NOT_RECOMMENDED`, never a percentage.
- **Alternatives:** Weighted-sum scoring with a 0–100 output.
- **Reason:** The engine's rules are ordinal judgments (tier comparisons, hard constraints).
  A percentage would imply calibration we don't have — fake precision is failure mode #1.
- **Consequences:** Ties inside a fit class are broken by cost then speed; users see
  the tie honestly via reduced confidence, not a fabricated 2-point score gap.

## D2 — Facts vs internal assessments, enforced in the type system

- **Decision:** `Fact<T>` (value + source + verified date + freshness) for anything
  verifiable; `Assessment<T>` (value + rationale + method + review date) for our judgments.
- **Alternatives:** Flat model objects with plain fields.
- **Reason:** Volatile facts rot; assessments are opinions. Mixing them is how stale
  pricing gets presented as truth.
- **Consequences:** Registry entries are verbose but every claim is auditable. The
  confidence engine can gate on freshness mechanically.

## D3 — Secondary-source facts are capped at AGING

- **Decision:** A fact verified only against aggregators (not vendor docs) can never
  be FRESH, even if checked today.
- **Alternatives:** Treat any recent check as FRESH.
- **Reason:** Aggregators lag and err; "recently copied" is not "recently verified".
- **Consequences:** With primary docs unreachable from the build environment, most
  facts sit at AGING and confidence caps at MEDIUM. That's honest, and it creates
  the right pressure to re-verify against primary sources.

## D4 — Fully client-side, no LLM calls in the router

- **Decision:** The router is deterministic TypeScript running in the browser.
- **Alternatives:** LLM-assisted task parsing / routing via an API.
- **Reason:** Deterministic logic is reproducible, testable, free, instant, and makes
  the PROCESSED LOCALLY claim true. The prompt says: prefer deterministic logic.
- **Consequences:** Task intake relies on ≤4 structured questions plus keyword
  prefill instead of free-text understanding. Acceptable at MVP quality; revisit only
  with evidence that intake quality is the bottleneck.

## D5 — Ranking order: fit class → cost → speed

- **Decision:** Within the same fit class the cheaper model always wins; speed breaks
  remaining ties only when the task is latency-sensitive.
- **Alternatives:** Blended multi-factor score.
- **Reason:** Implements the routing philosophy (capability → reliability → constraints
  → cost → speed) with no hidden weights, and makes the premium-bias test enforceable.
- **Consequences:** A premium model can only win by being in a higher fit class —
  which requires the task to actually demand its capability.

## D6 — Over-capability is a penalty, gated by budget preference

- **Decision:** A model ≥2 tiers above the requirement is demoted to ACCEPTABLE
  (WEAK at bulk scale) unless the user chose "quality first".
- **Alternatives:** No penalty (cost ranking alone).
- **Reason:** Cost ranking alone still lets frontier models tie in fit with small
  models on trivial tasks; the demotion encodes "right-sized beats maximal" and the
  counterexample test proves it doesn't block premium models when they're genuinely needed.
- **Consequences:** Benchmark F penalizes Fable 5 on bulk invoice extraction with an
  explicit reason string, not silently.

## D7 — Benchmarks assert properties, not model names

- **Decision:** Tests assert e.g. "winner is not FRONTIER and costs < $2/M blended",
  not "winner is Gemini Flash-Lite".
- **Alternatives:** Golden-output tests.
- **Reason:** Registry data will change; the *behavior* (cheap model wins simple task)
  is the contract. Golden names would rot with every price change.
- **Consequences:** A price change can legitimately flip the named winner without a
  test failure — regression review (§14) applies to behavior, not names.

## D8 — 'diagram' modality is satisfied by image support

- **Decision:** A model that accepts images satisfies a diagram requirement.
- **Reason:** Diagrams are images; a separate flag would artificially disqualify
  vision models whose docs don't say the word "diagram".
- **Consequences:** `scanned_page` remains distinct (document-vision/OCR quality is a
  real differentiator).
