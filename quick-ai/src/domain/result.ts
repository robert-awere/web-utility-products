/**
 * FIT ASSESSMENT — the output side of TASK × MODEL.
 * Categorical fit, separate confidence, structured explanations.
 * No numerical scores: the fit computation is rule-based, not weighted-sum,
 * so a percentage would be fake precision (see docs/DECISIONS.md).
 */

import type { ModelProfile } from './model';

export type FitLevel = 'BEST_FIT' | 'STRONG' | 'ACCEPTABLE' | 'WEAK' | 'NOT_RECOMMENDED';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type ReasonSign = '+' | '-' | '△';

export interface Reason {
  sign: ReasonSign;
  text: string;
}

export interface ModelEvaluation {
  model: ModelProfile;
  fit: FitLevel;
  /** Structured reasons accumulated during evaluation. */
  reasons: Reason[];
  /** true if a hard constraint disqualified the model. */
  disqualified: boolean;
  /** Blended cost used for ranking (null if pricing unknown). */
  cost: number | null;
}

export interface ConfidenceResult {
  level: Confidence;
  /** Why confidence is what it is — always disclosed. */
  factors: string[];
}

/** The router can also conclude that no AI is needed. */
export interface NoAiOutcome {
  kind: 'no_ai';
  reason: string;
  suggestion: string;
  confidence: ConfidenceResult;
}

export interface Alternative {
  evaluation: ModelEvaluation;
  whyLost: Reason[];
}

export interface RecommendationOutcome {
  kind: 'recommendation';
  winner: ModelEvaluation;
  whyWon: Reason[];
  watchOut: Reason[];
  alternatives: Alternative[];
  /** Cheapest option with fit >= ACCEPTABLE that costs less than the winner. */
  cheaperOption: ModelEvaluation | null;
  whatCouldChange: string[];
  workflow: string[];
  confidence: ConfidenceResult;
  /** Full evaluation table, for progressive disclosure. */
  allEvaluations: ModelEvaluation[];
}

export type RouterOutcome = NoAiOutcome | RecommendationOutcome;

const FIT_ORDER: FitLevel[] = ['NOT_RECOMMENDED', 'WEAK', 'ACCEPTABLE', 'STRONG', 'BEST_FIT'];

export function fitRank(f: FitLevel): number {
  return FIT_ORDER.indexOf(f);
}
