/**
 * COST LEAK — "why is my AI usage expensive?"
 *
 * Deterministic diagnostics over a usage questionnaire. Each finding names
 * the likely cost source, its severity, the evidence (the user's own
 * answers), and a corrective action. The task/model-mismatch check reuses
 * the router's fit engine — no separate scoring.
 */

import type { ModelProfile } from '../domain/model';
import { blendedCost } from '../domain/model';
import { fitRank } from '../domain/result';
import type { Complexity, TaskCategory } from '../domain/task';
import { defaultTaskProfile } from '../domain/task';
import { evaluateModel } from './fit';

export interface UsageProfile {
  currentModelId: string;
  taskCategory: TaskCategory;
  taskComplexity: Complexity;
  /** Typical input size per call. */
  inputSize: 'small' | 'medium' | 'large' | 'huge'; // <1K / 1–10K / 10–100K / >100K tokens
  /** Typical output size per call. */
  outputSize: 'short' | 'medium' | 'long'; // <500 / 500–2K / >2K tokens
  systemPromptSize: 'small' | 'medium' | 'large'; // <1K / 1–5K / >5K tokens
  /** Does each call resend largely the same context (docs, instructions)? */
  repeatedContext: boolean;
  cachingEnabled: 'yes' | 'no' | 'unknown';
  sessions: 'single_shot' | 'short' | 'long'; // long = many turns, full history resent
  agents: 'none' | 'single' | 'multi';
  toolCalls: 'none' | 'few' | 'many';
  rag: 'none' | 'chunks' | 'whole_documents';
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CostFinding {
  title: string;
  severity: Severity;
  evidence: string;
  action: string;
}

export interface CostDiagnosis {
  findings: CostFinding[];
  /** Suggested cheaper architecture, when the findings support one. */
  cheaperArchitecture: string[] | null;
  /** Honest empty-state message when nothing looks wrong. */
  allClear: string | null;
}

const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function diagnoseCost(usage: UsageProfile, registry: ModelProfile[]): CostDiagnosis {
  const findings: CostFinding[] = [];
  const current = registry.find((m) => m.id === usage.currentModelId);

  // 1. Task/model mismatch — reuse the fit engine.
  if (current) {
    const task = {
      ...defaultTaskProfile('cost-leak analysis'),
      category: usage.taskCategory,
      complexity: usage.taskComplexity,
      reasoningDepth:
        usage.taskComplexity === 'trivial' ? ('none' as const)
        : usage.taskComplexity === 'simple' ? ('light' as const)
        : usage.taskComplexity === 'moderate' ? ('moderate' as const)
        : ('deep' as const),
      answeredFields: ['category', 'complexity'],
    };
    const currentEval = evaluateModel(current, task);
    const currentCost = currentEval.cost ?? blendedCost(current);
    const cheaperStrong = registry
      .map((m) => evaluateModel(m, task))
      .filter(
        (e) =>
          e.model.id !== current.id &&
          fitRank(e.fit) >= fitRank('STRONG') &&
          e.cost != null &&
          currentCost != null &&
          e.cost < currentCost,
      )
      .sort((a, b) => a.cost! - b.cost!)[0];
    if (cheaperStrong && currentCost != null) {
      const pct = Math.round((1 - cheaperStrong.cost! / currentCost) * 100);
      if (pct >= 20) {
        findings.push({
          title: 'Premium model on routine work',
          severity: 'HIGH',
          evidence: `You run ${current.model} on ${usage.taskComplexity} ${usage.taskCategory} work; ${cheaperStrong.model.model} fits this strongly at ~${pct}% lower per-token cost.`,
          action: `Trial ${cheaperStrong.model.model} on ~20 representative examples; switch if quality holds. (Pricing freshness: see the data note — verify before committing budget.)`,
        });
      }
    }
  }

  // 2. Repeated context without caching — usually the single biggest leak.
  if (usage.repeatedContext && usage.cachingEnabled !== 'yes') {
    findings.push({
      title: 'Repeated context, no prompt caching',
      severity: 'HIGH',
      evidence: `Each call resends largely the same context, and caching is ${usage.cachingEnabled === 'no' ? 'off' : 'not confirmed on'}.`,
      action: 'Enable prompt caching on the stable prefix (system prompt, shared documents). Cached reads are typically ~90% cheaper than resending.',
    });
  }

  // 3. Large system prompt — a tax on every single call.
  if (usage.systemPromptSize === 'large') {
    findings.push({
      title: 'Oversized system prompt',
      severity: usage.cachingEnabled === 'yes' ? 'LOW' : 'MEDIUM',
      evidence: 'Your system prompt exceeds ~5K tokens and is paid on every call.',
      action: usage.cachingEnabled === 'yes'
        ? 'Caching softens this, but trim instructions the model no longer needs — shorter prompts also improve behavior.'
        : 'Trim it, and cache the stable part — every 1K tokens removed is saved on every call you make.',
    });
  }

  // 4. Long sessions resend the whole history each turn.
  if (usage.sessions === 'long') {
    findings.push({
      title: 'Long sessions resend full history every turn',
      severity: 'MEDIUM',
      evidence: 'Multi-turn sessions resend the entire conversation on each turn — cost grows with the square of session length.',
      action: 'Use context compaction/summarization past ~20 turns, cache the conversation prefix, and start fresh sessions per task where possible.',
    });
  }

  // 5. RAG that stuffs whole documents.
  if (usage.rag === 'whole_documents') {
    findings.push({
      title: 'RAG retrieves whole documents',
      severity: 'MEDIUM',
      evidence: 'Retrieval feeds entire documents into context instead of relevant chunks.',
      action: 'Chunk documents (~500–1500 tokens) and retrieve only top-matching chunks; most of a whole document is irrelevant to any one query.',
    });
  }

  // 6. Multi-agent overhead.
  if (usage.agents === 'multi') {
    findings.push({
      title: 'Multi-agent overhead',
      severity: 'MEDIUM',
      evidence: 'Every agent re-establishes context, explores, and reports back — token spend multiplies with agent count.',
      action: 'Cap concurrent agents, put cheap models on the worker agents, and reserve the premium model for coordination/synthesis.',
    });
  }

  // 7. Many tool calls: each round trip re-bills the conversation so far.
  if (usage.toolCalls === 'many') {
    findings.push({
      title: 'Many tool-call round trips',
      severity: usage.cachingEnabled === 'yes' ? 'LOW' : 'MEDIUM',
      evidence: 'Each tool round trip resends the conversation so far as input tokens.',
      action: 'Batch independent tool calls, cache the prefix, and move deterministic steps out of the loop into plain code.',
    });
  }

  // 8. Input/output balance information.
  if ((usage.inputSize === 'large' || usage.inputSize === 'huge') && usage.outputSize === 'short') {
    findings.push({
      title: 'Input-heavy workload',
      severity: 'LOW',
      evidence: 'You send far more tokens than you get back — input volume dominates your bill.',
      action: 'Focus savings on the input side: caching, tighter retrieval, and trimming boilerplate context beat switching models.',
    });
  } else if (usage.outputSize === 'long') {
    findings.push({
      title: 'Output-heavy workload',
      severity: 'LOW',
      evidence: 'Output tokens typically cost ~5x input tokens, and you generate long outputs.',
      action: 'Constrain output length where possible (structured formats, length instructions) — verbosity is billed.',
    });
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Cheaper architecture, only when the evidence supports one.
  let cheaperArchitecture: string[] | null = null;
  if (findings.filter((f) => f.severity !== 'LOW').length >= 2) {
    cheaperArchitecture = [
      'Cache the stable prefix (system prompt + shared context) so repeated tokens are ~90% cheaper.',
      'Right-size the model per step: cheap model for routine steps, premium only where quality demonstrably requires it.',
      'Move deterministic steps (routing, validation, formatting) out of the model into plain code.',
      'Bound context growth: chunked retrieval instead of whole documents, compaction for long sessions.',
    ];
  }

  return {
    findings,
    cheaperArchitecture,
    allClear:
      findings.length === 0
        ? 'Nothing in your answers points at a major leak. Your spend is likely proportional to genuine usage — the remaining levers are batch processing (~50% off for non-urgent work) and periodic re-checks of model pricing.'
        : null,
  };
}
