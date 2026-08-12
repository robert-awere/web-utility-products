/**
 * FIT LOGIC — deterministic TASK × MODEL evaluation.
 *
 * Routing philosophy (docs/DECISIONS.md):
 *   CAPABILITY REQUIREMENT -> RELIABILITY MARGIN -> PRIVACY/TOOL CONSTRAINTS
 *   -> COST -> SPEED.
 * A premium model must lose when a cheaper option satisfies the task safely.
 *
 * The result is categorical (FitLevel), never a percentage: the rules below
 * are ordinal judgments, not calibrated weights.
 */

import type { CapabilityTier, ModelProfile } from '../domain/model';
import { blendedCost, tierRank } from '../domain/model';
import type { FitLevel, ModelEvaluation, Reason } from '../domain/result';
import type { TaskProfile } from '../domain/task';

/** Which capability assessment matters most for a task category. */
export function primaryCapability(task: TaskProfile): keyof Pick<ModelProfile, 'reasoning' | 'coding' | 'writing' | 'research'> {
  switch (task.category) {
    case 'coding':
      return 'coding';
    case 'research':
      return 'research';
    case 'writing':
    case 'summarization':
    case 'translation':
    case 'conversation':
      return 'writing';
    default:
      return 'reasoning';
  }
}

/** Capability tier the task requires. */
export function requiredTier(task: TaskProfile): CapabilityTier {
  let tier: CapabilityTier;
  switch (task.complexity) {
    case 'trivial':
    case 'simple':
      tier = 'LOW';
      break;
    case 'moderate':
      tier = 'MEDIUM';
      break;
    case 'complex':
      tier = 'HIGH';
      break;
    case 'frontier':
      tier = 'FRONTIER';
      break;
  }
  // Deep reasoning raises the floor to HIGH even for nominally moderate tasks.
  if (task.reasoningDepth === 'deep' && tierRank(tier) < tierRank('HIGH')) tier = 'HIGH';
  if (task.reasoningDepth === 'moderate' && tierRank(tier) < tierRank('MEDIUM')) tier = 'MEDIUM';
  return tier;
}

function demote(fit: FitLevel): FitLevel {
  switch (fit) {
    case 'BEST_FIT': return 'STRONG';
    case 'STRONG': return 'ACCEPTABLE';
    case 'ACCEPTABLE': return 'WEAK';
    default: return 'NOT_RECOMMENDED';
  }
}

export function evaluateModel(model: ModelProfile, task: TaskProfile): ModelEvaluation {
  const reasons: Reason[] = [];
  let disqualified = false;
  let fit: FitLevel = 'STRONG';

  // ---- Hard constraints (privacy, modality, context, tools) ----

  if (task.privacy === 'strict_local' && !model.privacyCharacteristics.canRunLocally) {
    reasons.push({ sign: '-', text: 'cannot run on your infrastructure — data would leave your environment' });
    disqualified = true;
  }
  if (model.privacyCharacteristics.canRunLocally && task.privacy !== 'standard') {
    reasons.push({ sign: '+', text: 'data never leaves your infrastructure' });
  } else if (task.privacy === 'sensitive' && !model.privacyCharacteristics.canRunLocally) {
    reasons.push({ sign: '△', text: 'confidential data goes to an external provider — confirm data-handling terms first' });
    fit = demote(fit);
  }

  const supported = model.supportedModalities.value;
  // A diagram is an image; scanned pages need document-vision support.
  const satisfies = (mod: string) =>
    supported.includes(mod) || (mod === 'diagram' && supported.includes('image'));
  for (const mod of task.modalities) {
    if (mod === 'text') continue;
    if (!satisfies(mod)) {
      if (model.supportedModalities.freshness === 'UNKNOWN') {
        reasons.push({ sign: '△', text: `support for ${mod} input is unverified` });
        fit = demote(fit);
      } else {
        reasons.push({ sign: '-', text: `does not accept ${mod} input` });
        disqualified = true;
      }
    }
  }
  if (task.modalities.some((m) => m !== 'text') && !disqualified) {
    const nonText = task.modalities.filter((m) => m !== 'text');
    if (nonText.every((m) => satisfies(m))) {
      reasons.push({ sign: '+', text: `accepts the required ${nonText.join(', ')} input` });
    }
  }

  if (task.contextNeededTokens != null) {
    const limit = model.contextLimit.value;
    if (limit == null) {
      reasons.push({ sign: '△', text: 'context window unverified — cannot confirm the input fits' });
      fit = demote(fit);
    } else if (task.contextNeededTokens > limit) {
      if (task.contextNeededTokens <= limit * 5) {
        reasons.push({ sign: '-', text: `input (~${fmtTokens(task.contextNeededTokens)} tokens) exceeds the ${fmtTokens(limit)} context window — chunking or retrieval required` });
        fit = demote(fit);
      } else {
        reasons.push({ sign: '-', text: `input (~${fmtTokens(task.contextNeededTokens)} tokens) is far beyond the ${fmtTokens(limit)} context window` });
        disqualified = true;
      }
    } else if (task.contextNeededTokens > 100_000) {
      reasons.push({ sign: '+', text: `${fmtTokens(limit)} context window fits the ~${fmtTokens(task.contextNeededTokens)}-token input` });
    }
  }

  if (task.toolRequirements.length > 0) {
    if (model.supportsTools.value === false) {
      reasons.push({ sign: '-', text: 'does not support the tool/API calls this task needs' });
      disqualified = true;
    } else if (model.supportsTools.value == null || model.supportsTools.freshness === 'UNKNOWN') {
      reasons.push({ sign: '△', text: 'tool-calling support unverified' });
      fit = demote(fit);
    }
  }

  // Agentic tasks lean on agent fit.
  if ((task.autonomy === 'multi_step' || task.autonomy === 'scheduled' || task.autonomy === 'continuous')) {
    const agentTier = tierRank(model.agentFit.value);
    if (agentTier < tierRank('MEDIUM')) {
      reasons.push({ sign: '-', text: 'not suited to autonomous multi-step work' });
      fit = demote(fit);
    } else if (agentTier >= tierRank('HIGH')) {
      reasons.push({ sign: '+', text: 'strong fit for autonomous multi-step work' });
    }
  }

  // ---- Capability requirement ----
  const capKey = primaryCapability(task);
  const need = requiredTier(task);
  const have = model[capKey].value;
  const gap = tierRank(have) - tierRank(need);

  if (gap <= -2) {
    reasons.push({ sign: '-', text: `well below the ${need.toLowerCase()} ${capKey} capability this task needs` });
    disqualified = true;
  } else if (gap === -1) {
    reasons.push({ sign: '-', text: `likely below the ${capKey} capability this task needs` });
    fit = demote(demote(fit)); // STRONG -> WEAK
  } else if (gap === 0) {
    if (task.reliability === 'critical') {
      reasons.push({ sign: '△', text: 'capability matches but leaves no margin for a task where failure is costly' });
      fit = demote(fit);
    } else {
      reasons.push({ sign: '+', text: `${capKey} capability matches the task` });
    }
  } else if (gap === 1) {
    reasons.push({ sign: '+', text: `${capKey} capability with comfortable margin` });
  } else {
    // gap >= 2: over-capability
    if (task.budget === 'quality_first') {
      reasons.push({ sign: '+', text: 'top-tier capability, as requested' });
    } else {
      reasons.push({ sign: '-', text: 'far more capability than the task needs — you would pay for capability you do not use' });
      fit = demote(fit); // STRONG -> ACCEPTABLE
      if (task.scale === 'bulk') {
        reasons.push({ sign: '-', text: 'that overpayment multiplies across bulk volume' });
        fit = demote(fit); // -> WEAK
      }
    }
  }

  // ---- Speed (last in the philosophy) ----
  if (task.latency === 'realtime' && model.speed.value === 'slow') {
    reasons.push({ sign: '-', text: 'too slow for a real-time use case' });
    fit = demote(fit);
  } else if (task.latency === 'interactive' && model.speed.value === 'slow') {
    reasons.push({ sign: '△', text: 'slow turns may frustrate interactive use' });
  } else if (task.latency !== 'flexible' && model.speed.value === 'fast') {
    reasons.push({ sign: '+', text: 'fast responses suit the latency requirement' });
  }

  // ---- Cost note (informational; ordering handles preference) ----
  const cost = blendedCost(model);
  if (cost == null && model.deployment !== 'local') {
    reasons.push({ sign: '△', text: 'pricing unverified' });
  }

  if (disqualified) fit = 'NOT_RECOMMENDED';

  return { model, fit, reasons, disqualified, cost };
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
