/**
 * MODEL DOWNGRADER — "can I use a cheaper model?"
 *
 * Default bias (build spec §3D): the least expensive option that reliably
 * satisfies the task. Reuses the router's fit engine — no separate scoring.
 *
 * Verdicts:
 *  - use_deterministic_code : the task doesn't need AI at all
 *  - downgrade              : a cheaper model fits the task strongly
 *  - split_workflow         : route routine cases cheap, escalate hard ones
 *  - upgrade                : honest inverse — the current model is too weak
 *  - keep                   : nothing cheaper is safe (or savings negligible)
 */

import type { ModelProfile } from '../domain/model';
import { blendedCost } from '../domain/model';
import type { ConfidenceResult, ModelEvaluation, Reason } from '../domain/result';
import { fitRank } from '../domain/result';
import type { TaskProfile } from '../domain/task';
import { computeConfidence } from './confidence';
import { evaluateModel } from './fit';
import { checkNoAi } from './noai';

export type DowngradeVerdict =
  | 'use_deterministic_code'
  | 'downgrade'
  | 'split_workflow'
  | 'upgrade'
  | 'keep';

export interface DowngradeOutcome {
  verdict: DowngradeVerdict;
  current: ModelEvaluation | null;
  recommended: ModelEvaluation | null;
  /** Rounded % reduction in blended per-token cost, when both costs are known. */
  savingsPct: number | null;
  reasons: Reason[];
  confidence: ConfidenceResult;
}

/** Switching models has real friction — don't recommend it for pocket change. */
const MIN_SAVINGS_PCT = 20;

function savings(current: ModelEvaluation, candidate: ModelEvaluation): number | null {
  if (current.cost == null || candidate.cost == null || current.cost <= 0) return null;
  return Math.round((1 - candidate.cost / current.cost) * 100);
}

export function downgrade(
  task: TaskProfile,
  currentModel: ModelProfile,
  registry: ModelProfile[],
): DowngradeOutcome {
  const reasons: Reason[] = [];

  // 1. The cheapest model is no model.
  const noAi = checkNoAi(task);
  if (noAi) {
    return {
      verdict: 'use_deterministic_code',
      current: null,
      recommended: null,
      savingsPct: 100,
      reasons: [
        { sign: '+', text: noAi.reason },
        { sign: '+', text: noAi.suggestion },
        { sign: '+', text: `dropping ${currentModel.model} entirely removes this cost line` },
      ],
      confidence: computeConfidence(task, null, null),
    };
  }

  const evaluations = registry.map((m) => evaluateModel(m, task));
  const current = evaluations.find((e) => e.model.id === currentModel.id) ?? evaluateModel(currentModel, task);
  const currentCost = current.cost ?? blendedCost(currentModel);

  // 2. Honest inverse: the current model doesn't actually fit the task.
  if (fitRank(current.fit) < fitRank('ACCEPTABLE')) {
    const best = [...evaluations]
      .filter((e) => fitRank(e.fit) >= fitRank('STRONG'))
      .sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity))[0] ?? null;
    reasons.push({ sign: '-', text: `${currentModel.model} is a poor fit for this task in the first place:` });
    reasons.push(...current.reasons.filter((r) => r.sign === '-'));
    if (best) reasons.push({ sign: '+', text: `${best.model.model} fits the task; cost is secondary to getting usable output` });
    return {
      verdict: 'upgrade',
      current,
      recommended: best,
      savingsPct: best && currentCost != null ? savings({ ...current, cost: currentCost }, best) : null,
      reasons,
      confidence: computeConfidence(task, best, current),
    };
  }

  // 3. Cheaper candidates, split by how safely they fit.
  const cheaper = evaluations.filter(
    (e) => e.model.id !== currentModel.id && e.cost != null && currentCost != null && e.cost < currentCost,
  );
  const cheaperStrong = cheaper
    .filter((e) => fitRank(e.fit) >= fitRank('STRONG'))
    .sort((a, b) => a.cost! - b.cost!);
  const cheaperAcceptable = cheaper
    .filter((e) => e.fit === 'ACCEPTABLE')
    .sort((a, b) => a.cost! - b.cost!);

  const bestStrong = cheaperStrong[0];
  if (bestStrong) {
    const pct = savings({ ...current, cost: currentCost }, bestStrong);
    if (pct != null && pct >= MIN_SAVINGS_PCT) {
      reasons.push({ sign: '+', text: `${bestStrong.model.model} fits this task strongly at ~${pct}% lower per-token cost` });
      reasons.push(...bestStrong.reasons.filter((r) => r.sign === '+').slice(0, 3));
      const overkill = current.reasons.find((r) => /more capability than the task needs/.test(r.text));
      if (overkill) reasons.push({ sign: '-', text: `${currentModel.model}: ${overkill.text}` });
      reasons.push({ sign: '△', text: 'validate on ~20 representative examples before switching production traffic' });
      return {
        verdict: 'downgrade',
        current,
        recommended: bestStrong,
        savingsPct: pct,
        reasons,
        confidence: computeConfidence(task, bestStrong, current),
      };
    }
    reasons.push({ sign: '△', text: `${bestStrong.model.model} is cheaper but only by ~${pct ?? '?'}% — below the ${MIN_SAVINGS_PCT}% threshold where switching friction pays off` });
  }

  // 4. Bulk workloads: escalation beats a blanket premium model.
  const bestAcceptable = cheaperAcceptable[0];
  if (task.scale === 'bulk' && bestAcceptable) {
    const pct = savings({ ...current, cost: currentCost }, bestAcceptable);
    reasons.push({ sign: '+', text: `most bulk items are routine — run them on ${bestAcceptable.model.model} (~${pct ?? '?'}% cheaper per token)` });
    reasons.push({ sign: '+', text: `escalate only items the cheap model flags as uncertain to ${currentModel.model}` });
    reasons.push({ sign: '△', text: `${bestAcceptable.model.model} alone is only an acceptable fit — the escalation path is what makes this safe` });
    return {
      verdict: 'split_workflow',
      current,
      recommended: bestAcceptable,
      savingsPct: pct,
      reasons,
      confidence: computeConfidence(task, bestAcceptable, current),
    };
  }

  // 5. Keep — and say why honestly.
  if (reasons.length === 0) {
    reasons.push({ sign: '+', text: `no cheaper model fits this task safely — ${currentModel.model} is already right-sized` });
  }
  if (bestAcceptable && task.scale !== 'bulk') {
    reasons.push({ sign: '△', text: `${bestAcceptable.model.model} would be cheaper but only fits acceptably — worth a try only if cost pressure is high` });
  }
  return {
    verdict: 'keep',
    current,
    recommended: null,
    savingsPct: null,
    reasons,
    confidence: computeConfidence(task, current, bestStrong ?? bestAcceptable ?? null),
  };
}
