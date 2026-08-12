/**
 * MODEL PROFILE — the shared model-side domain primitive.
 *
 * Two strictly separated kinds of data (see docs/DECISIONS.md):
 *  - FACTS   (pricing, context limits, modality support): must carry a source,
 *    a verification date, and a freshness status. Volatile.
 *  - INTERNAL ASSESSMENTS (capability ratings): must carry a rationale, an
 *    assessment method, and a review date. Never presented as vendor facts.
 */

export type Freshness = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

/** A verifiable fact about a model. */
export interface Fact<T> {
  value: T;
  /** Where this was verified (URL or named source). */
  source: string;
  /** ISO date the fact was last verified against the source. */
  verified: string;
  freshness: Freshness;
  /** Honest caveat, e.g. "secondary source; primary docs unreachable". */
  note?: string;
}

/** An unverifiable fact slot: we deliberately record that we don't know. */
export function unknownFact<T>(note: string): Fact<T | null> {
  return { value: null, source: 'none', verified: 'never', freshness: 'UNKNOWN', note };
}

export type CapabilityTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'FRONTIER';

/** An internal assessment — our judgment, not a vendor claim. */
export interface Assessment<T> {
  value: T;
  rationale: string;
  method: string;
  lastReviewed: string;
}

export type Deployment = 'api' | 'local' | 'either';

export type SpeedClass = 'fast' | 'medium' | 'slow';

export interface ModelProfile {
  id: string;
  provider: string;
  model: string;
  family: string;
  availability: 'general' | 'restricted' | 'self_hosted';
  deployment: Deployment;

  // ---- Internal assessments (rated by us) ----
  reasoning: Assessment<CapabilityTier>;
  coding: Assessment<CapabilityTier>;
  writing: Assessment<CapabilityTier>;
  research: Assessment<CapabilityTier>;
  agentFit: Assessment<CapabilityTier>;
  toolUse: Assessment<CapabilityTier>;
  speed: Assessment<SpeedClass>;

  // ---- Verifiable facts (sourced + dated) ----
  /** USD per million input tokens. */
  inputCost: Fact<number | null>;
  /** USD per million output tokens. */
  outputCost: Fact<number | null>;
  /** Context window in tokens. */
  contextLimit: Fact<number | null>;
  /** Input modalities the model accepts. */
  supportedModalities: Fact<string[]>;
  /** Whether the model supports native tool/function calling. */
  supportsTools: Fact<boolean | null>;

  privacyCharacteristics: {
    /** true if inference can run entirely on user-controlled infrastructure */
    canRunLocally: boolean;
    note: string;
  };

  strengths: string[];
  weaknesses: string[];
}

const TIER_ORDER: CapabilityTier[] = ['LOW', 'MEDIUM', 'HIGH', 'FRONTIER'];

export function tierRank(t: CapabilityTier): number {
  return TIER_ORDER.indexOf(t);
}

/** Blended cost heuristic for ranking: assumes ~3:1 input:output token ratio. */
export function blendedCost(m: ModelProfile): number | null {
  if (m.inputCost.value == null || m.outputCost.value == null) return null;
  return (3 * m.inputCost.value + m.outputCost.value) / 4;
}

/**
 * Freshness classification from a verification date.
 * FRESH <= 30 days, AGING <= 120 days, STALE beyond that.
 */
export function classifyFreshness(verifiedIso: string, todayIso: string): Freshness {
  const verified = Date.parse(verifiedIso);
  const today = Date.parse(todayIso);
  if (Number.isNaN(verified) || Number.isNaN(today)) return 'UNKNOWN';
  const days = (today - verified) / 86_400_000;
  if (days <= 30) return 'FRESH';
  if (days <= 120) return 'AGING';
  return 'STALE';
}
