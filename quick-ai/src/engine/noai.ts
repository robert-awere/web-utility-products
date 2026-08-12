/**
 * NO-AI GATE — the router is allowed (required) to say "don't use AI".
 * Deterministic categories where conventional software is strictly better:
 * exact, reproducible, auditable, free.
 */

import type { TaskProfile } from '../domain/task';

interface NoAiRule {
  reason: string;
  suggestion: string;
}

const NO_AI_CATEGORIES: Partial<Record<TaskProfile['category'], NoAiRule>> = {
  math_exact: {
    reason: 'Exact arithmetic is deterministic. A language model approximates; a calculator is exact, instant, and free.',
    suggestion: 'Use a calculator, spreadsheet, or a few lines of code. If this is part of a pipeline, compute it in code and reserve AI for the judgment steps.',
  },
  exact_lookup: {
    reason: 'Exact lookups need a database or index, not a model. A model can misremember; a query cannot.',
    suggestion: 'Query the source of record directly (database, API, search index).',
  },
  simple_transform: {
    reason: 'Simple, rule-describable transformations are cheaper, faster, and 100% reliable in ordinary code.',
    suggestion: 'Write the transformation in code (or a spreadsheet formula). AI adds cost and a failure rate to a solved problem.',
  },
  validation: {
    reason: 'Rule-based validation should be deterministic: the rules are known, so encode them.',
    suggestion: 'Implement the rules with a validator/schema library. Use AI only for the genuinely ambiguous residue, if any.',
  },
};

export function checkNoAi(task: TaskProfile): NoAiRule | null {
  const rule = NO_AI_CATEGORIES[task.category];
  if (rule) return rule;
  return null;
}
