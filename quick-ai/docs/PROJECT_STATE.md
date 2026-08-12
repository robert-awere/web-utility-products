# PROJECT STATE — QUICK//AI

Updated: 2026-08-12 (Phase 2, increment 1)

## Current phase

**Phase 2 — additional tools on shared primitives (user-approved 2026-08-12).**
Increments 1–5 complete: Agent or Chat?, Model Downgrader, live freshness
recomputation, Cost Leak, Can AI Handle This?. **All five MVP tools shipped.**
Phase 1 — Router Proof: COMPLETE.

## MVP completion criteria (spec §24)

arrive → describe task → answer ≤4 meaningful questions → receive recommendation
→ understand why → see cheaper/alternative option → see uncertainty → act:
**all steps verified end-to-end in a headless browser** (scripts/smoke.mjs, 20 checks).
Recommendations render instantly (fully client-side deterministic logic — well
under the 30-second target).

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
- **Phase 2 / "Agent or Chat?"** (src/engine/interaction.ts): deterministic classifier
  over the shared TaskProfile — 10 modes (chat/agent/automation/no-AI). Anti-agent-hype
  invariant tested: no autonomy + no tools can never yield an agent recommendation.
  UI tool tabs; constraint questions hidden where they can't change the answer.
- **Phase 2 / "Model Downgrader"** (src/engine/downgrader.ts): reuses the fit engine.
  Verdicts: use_deterministic_code / downgrade (STRONG fit + ≥20% savings only) /
  split_workflow (bulk: cheap model + escalation path) / upgrade (honest inverse
  when the current model is too weak) / keep. Savings shown as blended per-token
  arithmetic on sourced facts, never a quality score.
- **Phase 2 / freshness recomputation** (src/domain/model.ts refreshFreshness):
  stored freshness is a baseline that only degrades with time at app load.
- **Phase 2 / "Cost Leak"** (src/engine/costleak.ts): severity-ranked findings with
  evidence + actions; task/model mismatch reuses the fit engine; honest all-clear.
- **Phase 2 / "Can AI Handle This?"** (src/engine/inspect.ts + src/ui/filefacts.ts):
  fully local file inspection (size, format, token estimate with disclosed basis,
  PDF page/image/scan heuristics, table detection) → verdict (direct / preprocess /
  chunk / impractical), failure modes, preprocessing, model class, fitting models.

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

87/87 passing (vitest). Smoke test 20/20 passing (playwright-core + preview server).

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

All five MVP tools are done. Remaining (see BACKLOG):
1. Registry re-verification against primary vendor docs (blocked on network access).
2. Benchmark regression snapshot script (spec §14 tooling).
3. Deployment (static hosting) — a product decision for the user.
