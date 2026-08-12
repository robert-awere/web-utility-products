# PROJECT STATE — QUICK//AI

Updated: 2026-08-12

## Current phase

**Phase 1 — Router Proof: COMPLETE (exit criteria below).** Phase 2 not started.

## Completed

- Shared domain primitives: `TaskProfile` (src/domain/task.ts), `ModelProfile` with
  fact/assessment separation (src/domain/model.ts), `RouterOutcome` (src/domain/result.ts).
- Verified model registry: 11 entries across Anthropic, OpenAI, Google, and a
  self-hosted open-weights option; every volatile fact carries source, date, freshness.
- Deterministic fit engine (src/engine/fit.ts): hard constraints (privacy, modality,
  context, tools) → capability requirement → reliability margin → over-capability
  penalty → speed. Categorical fit levels, no numeric scores.
- No-AI gate (src/engine/noai.ts): math/lookup/transform/validation → "don't use AI".
- Confidence engine (src/engine/confidence.ts): freshness gate + ambiguity + close-call,
  with disclosed factors. Separate from fit.
- Router (src/engine/router.ts): ranking (fit → cost → speed), why-won/why-lost,
  what-could-change, cheaper option, workflow steps.
- Benchmark suite: scenarios A–H (tests/router-benchmarks/scenarios.test.ts) +
  adversarial checks (premium bias, counterexample, close-call, explainability).
- UI: describe → 4 follow-up questions (prefilled by deterministic keyword heuristics)
  → compact explained result with progressive disclosure. Fully client-side;
  PROCESSED LOCALLY badge is truthful.
- Headless browser smoke test (scripts/smoke.mjs).

## Phase 1 exit criteria — status

| Criterion | Status |
|---|---|
| User can submit a task | PASS (smoke test) |
| Router returns a sensible recommendation | PASS (benchmarks A–F, H) |
| Recommendation exposes reasoning | PASS (explainability invariants test) |
| Cheaper models can beat premium models | PASS (premium bias test) |
| No-AI outcome works | PASS (benchmark G + smoke test) |
| Stale data lowers confidence | PASS (confidence freshness tests) |
| Benchmark scenarios pass | PASS (40/40 tests) |
| Build passes | PASS (`npm run build`) |
| Type checks pass | PASS (`tsc --noEmit`, strict) |
| Tests pass | PASS (`npm test`) |

## Architecture

```
src/domain/    task.ts, model.ts, result.ts      — shared primitives (all tools use these)
src/data/      registry.ts                        — verified model registry
src/engine/    noai.ts, fit.ts, confidence.ts,
               router.ts, prefill.ts              — deterministic logic, no LLM calls
src/ui/        main.ts, render.ts                 — thin UI over the engine
tests/         router-benchmarks/, engine/        — benchmarks + unit tests
```

## Test status

40/40 passing (vitest). Smoke test 9/9 passing (playwright-core + preview server).

## Known issues

- All registry facts are AGING or UNKNOWN (primary vendor docs are blocked from the
  build environment; OpenAI/Google verified via secondary aggregators only). The
  confidence engine discloses this on every recommendation — by design — but the
  registry needs a re-verification pass against primary sources when network access allows.
- GPT-5.6 context windows are UNKNOWN; affects large-input rankings (disclosed).
- Category prefill takes the first matching rule only; mixed-intent descriptions
  rely on the user correcting question 1.

## Blockers

None for Phase 1. Phase 2 requires a product decision on which tool to build next.

## Next likely increment

Phase 2, in priority order per the shared-primitives rule:
1. "Agent or Chat?" classifier (pure function over TaskProfile — smallest reuse step).
2. "Model Downgrader" (re-uses fit engine with a "current model" input).
3. Registry re-verification workflow + freshness recomputation at load time.
