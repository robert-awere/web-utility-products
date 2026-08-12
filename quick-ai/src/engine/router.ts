/**
 * ROUTER — orchestrates: no-AI gate -> evaluate all models -> rank ->
 * explain -> confidence -> workflow. Fully deterministic; no LLM calls.
 */

import type { ModelProfile } from '../domain/model';
import type {
  Alternative,
  ModelEvaluation,
  Reason,
  RecommendationOutcome,
  RouterOutcome,
} from '../domain/result';
import { fitRank } from '../domain/result';
import type { TaskProfile } from '../domain/task';
import { computeConfidence } from './confidence';
import { evaluateModel } from './fit';
import { checkNoAi } from './noai';

const SPEED_ORDER = { fast: 0, medium: 1, slow: 2 } as const;

export function route(task: TaskProfile, registry: ModelProfile[]): RouterOutcome {
  // 1. No-AI gate — a trust feature, checked before any model is considered.
  const noAi = checkNoAi(task);
  if (noAi) {
    return {
      kind: 'no_ai',
      reason: noAi.reason,
      suggestion: noAi.suggestion,
      confidence: computeConfidence(task, null, null),
    };
  }

  // 2. Evaluate every model.
  const evaluations = registry.map((m) => evaluateModel(m, task));

  // 3. Rank: fit class first; then cost ascending (cheaper capable model
  //    beats premium); then speed if latency-sensitive; then registry order.
  const ranked = [...evaluations].sort((a, b) => {
    const byFit = fitRank(b.fit) - fitRank(a.fit);
    if (byFit !== 0) return byFit;
    const ca = a.cost ?? Number.POSITIVE_INFINITY;
    const cb = b.cost ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    if (task.latency !== 'flexible') {
      const bySpeed = SPEED_ORDER[a.model.speed.value] - SPEED_ORDER[b.model.speed.value];
      if (bySpeed !== 0) return bySpeed;
    }
    return 0;
  });

  const winner = ranked[0];
  if (!winner || winner.fit === 'NOT_RECOMMENDED' || winner.fit === 'WEAK') {
    // Nothing genuinely fits. Be honest rather than forcing a recommendation.
    return {
      kind: 'no_ai',
      reason: 'No model in the registry fits this task well under your constraints.',
      suggestion: bestFailureAdvice(ranked),
      confidence: computeConfidence(task, winner ?? null, null),
    };
  }

  const runnerUp = ranked[1] ?? null;
  const alternatives: Alternative[] = ranked
    .slice(1, 4)
    .filter((e) => e.fit !== 'NOT_RECOMMENDED')
    .map((e) => ({ evaluation: e, whyLost: whyLost(e, winner) }));

  const cheaper = cheaperOption(ranked, winner);

  return {
    kind: 'recommendation',
    winner,
    whyWon: winner.reasons.filter((r) => r.sign === '+'),
    watchOut: winner.reasons.filter((r) => r.sign !== '+'),
    alternatives,
    cheaperOption: cheaper,
    whatCouldChange: whatCouldChange(task, winner, runnerUp),
    workflow: workflow(task, winner),
    confidence: computeConfidence(task, winner, runnerUp),
    allEvaluations: ranked,
  };
}

function whyLost(e: ModelEvaluation, winner: ModelEvaluation): Reason[] {
  const negatives = e.reasons.filter((r) => r.sign === '-' || r.sign === '△');
  if (negatives.length > 0) return negatives;
  // Same fit class, no recorded negatives: it lost on cost or speed.
  if (e.cost != null && winner.cost != null && e.cost > winner.cost) {
    return [{ sign: '-', text: `higher cost than ${winner.model.model} with no meaningful benefit for this task` }];
  }
  return [{ sign: '-', text: `no advantage over ${winner.model.model} for this task` }];
}

function cheaperOption(ranked: ModelEvaluation[], winner: ModelEvaluation): ModelEvaluation | null {
  if (winner.cost == null) return null;
  const candidates = ranked.filter(
    (e) =>
      e !== winner &&
      fitRank(e.fit) >= fitRank('ACCEPTABLE') &&
      e.cost != null &&
      e.cost < winner.cost!,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((min, e) => ((e.cost ?? Infinity) < (min.cost ?? Infinity) ? e : min));
}

function whatCouldChange(
  task: TaskProfile,
  winner: ModelEvaluation,
  runnerUp: ModelEvaluation | null,
): string[] {
  const out: string[] = [];
  if (task.privacy === 'standard') {
    out.push('If privacy requirements become strict (data must stay in-house), only a self-hosted model would qualify.');
  }
  if (task.budget !== 'quality_first' && winner.model.reasoning.value !== 'FRONTIER') {
    out.push('If output quality becomes the only priority, a frontier-tier model would rank higher despite its cost.');
  }
  if (task.budget !== 'minimize') {
    out.push('If cost pressure increases, re-run with "minimize cost" — a smaller model may become acceptable.');
  }
  if (task.contextNeededTokens == null) {
    out.push('If the input turns out to be very large (hundreds of pages), context-window limits would reshape this ranking.');
  }
  if (runnerUp && runnerUp.fit === winner.fit) {
    out.push(`${runnerUp.model.model} is close behind — provider preference or existing tooling could reasonably tip the choice.`);
  }
  return out;
}

function workflow(task: TaskProfile, winner: ModelEvaluation): string[] {
  const steps: string[] = [];
  const limit = winner.model.contextLimit.value;
  const needsChunking =
    task.contextNeededTokens != null && limit != null && task.contextNeededTokens > limit;

  if (needsChunking) {
    steps.push('Split the input into sections that fit the context window (or use retrieval to pull only relevant parts).');
  }
  if (task.scale === 'bulk') {
    steps.push('Run a pilot on a small sample (~50 items) and check accuracy before committing to the full volume.');
    steps.push('Use batch processing where the provider offers it — typically ~50% cheaper.');
  }
  if (task.autonomy === 'multi_step' || task.autonomy === 'scheduled' || task.autonomy === 'continuous') {
    steps.push('Define what "done" looks like up front — agents perform best with a complete, checkable goal.');
    steps.push('Add a checkpoint: review the agent\'s output before it takes irreversible actions.');
  }
  if (task.modalities.includes('scanned_page')) {
    steps.push('For scanned pages, verify extraction quality on a few samples — OCR-quality input drives output quality.');
  }
  if (steps.length === 0) {
    steps.push(`Start with a single representative example on ${winner.model.model} and check the output against your quality bar.`);
    steps.push('Iterate the prompt on failures before scaling up.');
  } else {
    steps.unshift(`Set up ${winner.model.model} for the task.`);
  }
  if (task.privacy === 'sensitive') {
    steps.push('Before sending anything: confirm the provider\'s data-retention and training-use terms cover confidential data.');
  }
  return steps;
}

function bestFailureAdvice(ranked: ModelEvaluation[]): string {
  const top = ranked[0];
  if (!top) return 'The registry is empty.';
  const blockers = top.reasons
    .filter((r) => r.sign === '-')
    .map((r) => r.text)
    .join('; ');
  return blockers
    ? `The closest option was ${top.model.model}, blocked by: ${blockers}. Relax one of those constraints, or solve this without AI.`
    : 'Consider whether conventional software covers this task.';
}
