# QUICK//AI — Right AI. Right task.

A task-to-AI decision engine. Describe a task, answer at most four questions, and get
an explained, honest recommendation for which AI model (or no AI at all) to use.

**Not** an AI directory, chat wrapper, prompt library, or leaderboard.

## Principles (enforced in code and tests)

- **No fake precision** — categorical fit levels, never percentages.
- **No stale facts presented as truth** — every volatile fact carries source, date,
  and freshness; stale data lowers the displayed confidence.
- **No premium bias** — a cheaper model that satisfies the task always outranks a
  premium one (tested adversarially).
- **"No AI needed" is a valid answer** — deterministic tasks get pointed at
  deterministic tools.
- **No black boxes** — every recommendation exposes why it won, why others lost, and
  what could change the result.
- **Private by construction** — everything runs client-side; task descriptions never
  leave the browser.

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # benchmark + unit suites (vitest)
npm run typecheck  # strict TS
npm run build      # typecheck + production build to dist/
node scripts/smoke.mjs  # headless end-to-end flow check (after build)
```

## Structure

- `src/domain/` — shared primitives: TaskProfile, ModelProfile (facts vs assessments), outcomes
- `src/data/registry.ts` — verified model registry (see `docs/MODEL_DATA.md`)
- `src/engine/` — deterministic routing: no-AI gate, fit, confidence, ranking, explanations
- `src/ui/` — thin UI over the engine
- `tests/router-benchmarks/` — fixed scenarios A–H + adversarial checks
- `docs/` — PROJECT_STATE, DECISIONS, BACKLOG, MODEL_DATA

## Status

Phase 1 (Router Proof) complete — see `docs/PROJECT_STATE.md`.
