/**
 * CONFIDENCE — separate from fit, never decorative.
 * Starts HIGH and steps down for: stale/unknown decisive data, task ambiguity
 * (unanswered dimensions), and close calls between the top options.
 * Every step down is recorded as a disclosed factor.
 */

import type { Fact } from '../domain/model';
import type { Confidence, ConfidenceResult, ModelEvaluation } from '../domain/result';
import type { TaskProfile } from '../domain/task';

const LEVELS: Confidence[] = ['HIGH', 'MEDIUM', 'LOW'];

function stepDown(level: Confidence, steps: number): Confidence {
  const idx = Math.min(LEVELS.indexOf(level) + steps, LEVELS.length - 1);
  return LEVELS[idx] as Confidence;
}

/** Facts that were decisive for ranking this model. */
function decisiveFacts(ev: ModelEvaluation, task: TaskProfile): Fact<unknown>[] {
  const facts: Fact<unknown>[] = [ev.model.inputCost, ev.model.outputCost];
  if (task.contextNeededTokens != null) facts.push(ev.model.contextLimit);
  if (task.modalities.some((m) => m !== 'text')) facts.push(ev.model.supportedModalities);
  if (task.toolRequirements.length > 0) facts.push(ev.model.supportsTools);
  return facts;
}

export function computeConfidence(
  task: TaskProfile,
  winner: ModelEvaluation | null,
  runnerUp: ModelEvaluation | null,
): ConfidenceResult {
  let level: Confidence = 'HIGH';
  const factors: string[] = [];

  // 1. Data freshness of decisive facts.
  if (winner) {
    const facts = decisiveFacts(winner, task);
    if (runnerUp) facts.push(...decisiveFacts(runnerUp, task));
    const worst = facts.reduce<'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN'>((acc, f) => {
      const order = { FRESH: 0, AGING: 1, STALE: 2, UNKNOWN: 2 } as const;
      return order[f.freshness] > order[acc] ? f.freshness : acc;
    }, 'FRESH');
    if (worst === 'STALE' || worst === 'UNKNOWN') {
      level = stepDown(level, 2);
      factors.push('Some decisive model facts are stale or unverified — treat pricing/limits as indicative, not exact.');
    } else if (worst === 'AGING') {
      level = stepDown(level, 1);
      factors.push('Model pricing/limits were last verified over a month ago — recheck before committing budget.');
    } else {
      factors.push('Decisive model facts are recently verified.');
    }
  }

  // 2. Task ambiguity — how much was answered vs defaulted.
  if (task.answeredFields.length < 2) {
    level = stepDown(level, 1);
    factors.push('Few task details were provided — the recommendation rests on defaults.');
  }

  // 3. Close call between the top options.
  if (winner && runnerUp && winner.fit === runnerUp.fit) {
    const a = winner.cost;
    const b = runnerUp.cost;
    const close =
      a != null && b != null
        ? Math.abs(a - b) <= 0.25 * Math.max(a, b)
        : true; // unknown costs at the same fit level: can't separate them
    if (close) {
      level = stepDown(level, 1);
      factors.push(
        `${winner.model.model} and ${runnerUp.model.model} are nearly equivalent for this task — small changes in constraints flip the result.`,
      );
    }
  }

  return { level, factors };
}
