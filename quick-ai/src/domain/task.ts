/**
 * TASK PROFILE — the shared task-side domain primitive.
 * Every tool (router, agent-or-chat, cost leak, downgrader, can-ai-handle-this)
 * speaks in terms of this profile. No tool defines its own task shape.
 */

export type TaskCategory =
  | 'writing'
  | 'coding'
  | 'research'
  | 'analysis'
  | 'classification'
  | 'extraction'
  | 'translation'
  | 'summarization'
  | 'conversation'
  | 'document_processing'
  | 'automation'
  | 'math_exact'
  | 'exact_lookup'
  | 'simple_transform'
  | 'validation'
  | 'other';

export type Complexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'frontier';

export type ReasoningDepth = 'none' | 'light' | 'moderate' | 'deep';

export type Modality = 'text' | 'image' | 'diagram' | 'audio' | 'video' | 'scanned_page';

export type Autonomy =
  | 'none'            // single question, single answer
  | 'single_step'     // one tool-assisted step
  | 'multi_step'      // agent works through steps in one run
  | 'scheduled'       // recurring / unattended runs
  | 'continuous';     // long-lived automation

export type ToolRequirement = 'web' | 'code_execution' | 'file_io' | 'external_api';

export type PrivacyLevel =
  | 'standard'        // no special constraint
  | 'sensitive'       // confidential; prefer strong data-handling terms
  | 'strict_local';   // data must not leave the user's infrastructure

export type LatencySensitivity = 'flexible' | 'interactive' | 'realtime';

export type BudgetSensitivity = 'minimize' | 'balanced' | 'quality_first';

export type ReliabilityNeed = 'best_effort' | 'high' | 'critical';

export type Scale = 'one_off' | 'recurring' | 'bulk';

export type OutputType = 'text' | 'structured' | 'code' | 'decision' | 'file';

export interface TaskProfile {
  description: string;
  category: TaskCategory;
  complexity: Complexity;
  reasoningDepth: ReasoningDepth;
  /** Estimated input context needed, in tokens. null = unknown/small. */
  contextNeededTokens: number | null;
  modalities: Modality[];
  autonomy: Autonomy;
  toolRequirements: ToolRequirement[];
  privacy: PrivacyLevel;
  latency: LatencySensitivity;
  budget: BudgetSensitivity;
  reliability: ReliabilityNeed;
  scale: Scale;
  outputType: OutputType;
  /**
   * Fields the user explicitly answered (vs defaulted). Used by the
   * confidence engine: many defaulted fields -> lower confidence.
   */
  answeredFields: string[];
}

/** Sensible defaults; every unanswered dimension is an explicit default, not a guess. */
export function defaultTaskProfile(description: string): TaskProfile {
  return {
    description,
    category: 'other',
    complexity: 'moderate',
    reasoningDepth: 'moderate',
    contextNeededTokens: null,
    modalities: ['text'],
    autonomy: 'none',
    toolRequirements: [],
    privacy: 'standard',
    latency: 'flexible',
    budget: 'balanced',
    reliability: 'high',
    scale: 'one_off',
    outputType: 'text',
    answeredFields: [],
  };
}
