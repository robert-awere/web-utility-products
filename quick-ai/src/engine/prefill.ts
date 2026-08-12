/**
 * PREFILL — deterministic keyword heuristics that pre-answer the follow-up
 * questions from the task description. The user always confirms/overrides;
 * this only reduces friction, it never decides alone.
 */

import type { TaskProfile } from '../domain/task';

export interface PrefillSuggestion {
  patch: Partial<TaskProfile>;
  matched: string[];
}

interface Rule {
  pattern: RegExp;
  label: string;
  patch: Partial<TaskProfile>;
}

const RULES: Rule[] = [
  { pattern: /\b(exact|sum|add up|arithmetic|calculat\w+|multiply|percentage of)\b/i, label: 'exact math', patch: { category: 'math_exact', complexity: 'trivial', reasoningDepth: 'none' } },
  { pattern: /\b(validate|validation|check format|schema)\b/i, label: 'validation', patch: { category: 'validation', complexity: 'simple' } },
  { pattern: /\b(monitor|every day|daily|weekly|hourly|schedule|automat\w+|scrape)\b/i, label: 'automation', patch: { category: 'automation', autonomy: 'scheduled', toolRequirements: ['web'], scale: 'recurring' } },
  { pattern: /\b(code|coding|bug|refactor|function|debug|program|script|api endpoint)\b/i, label: 'coding', patch: { category: 'coding', outputType: 'code' } },
  { pattern: /\b(research|investigate|compare options|find out|literature)\b/i, label: 'research', patch: { category: 'research', toolRequirements: ['web'] } },
  { pattern: /\b(classif\w+|sentiment|categoriz\w+|label|tag)\b/i, label: 'classification', patch: { category: 'classification', complexity: 'simple', reasoningDepth: 'light', outputType: 'decision' } },
  { pattern: /\b(extract|invoice|receipt|parse|pull out|fields? from)\b/i, label: 'extraction', patch: { category: 'extraction', outputType: 'structured' } },
  { pattern: /\b(translat\w+)\b/i, label: 'translation', patch: { category: 'translation', complexity: 'simple' } },
  { pattern: /\b(summar\w+|tl;?dr|key points)\b/i, label: 'summarization', patch: { category: 'summarization' } },
  { pattern: /\b(grammar|proofread|typo|spelling)\b/i, label: 'proofreading', patch: { category: 'writing', complexity: 'simple', reasoningDepth: 'none' } },
  { pattern: /\b(write|draft|essay|blog|email|post|copy)\b/i, label: 'writing', patch: { category: 'writing' } },
  { pattern: /\b(analy[sz]e|review document|assess|evaluate)\b/i, label: 'analysis', patch: { category: 'analysis' } },
];

const MODALITY_RULES: Rule[] = [
  { pattern: /\b(scan(s|ned)?|ocr|photographed)\b/i, label: 'scanned pages', patch: { modalities: ['text', 'scanned_page'] } },
  { pattern: /\b(diagrams?|charts?|figures?|schematics?)\b/i, label: 'diagrams', patch: { modalities: ['text', 'diagram'] } },
  { pattern: /\b(images?|photos?|pictures?|screenshots?)\b/i, label: 'images', patch: { modalities: ['text', 'image'] } },
];

const PRIVACY_RULE: Rule = {
  pattern: /\b(confidential|internal only|private|sensitive|proprietary|nda)\b/i,
  label: 'confidential data',
  patch: { privacy: 'sensitive' },
};

const BULK_RULE: Rule = {
  pattern: /\b(\d{1,3}(,\d{3})+|\d{4,})\s+(files|documents|invoices|records|rows|items|reviews|emails)\b/i,
  label: 'bulk volume',
  patch: { scale: 'bulk' },
};

/** "600-page", "600 pages" -> rough token estimate at ~800 tokens/page. */
function pageEstimate(description: string): number | null {
  const m = description.match(/(\d{1,4}(?:,\d{3})?)[-\s]?page/i);
  if (!m || !m[1]) return null;
  const pages = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(pages) || pages <= 0) return null;
  return pages * 800;
}

export function prefillFromDescription(description: string): PrefillSuggestion {
  const matched: string[] = [];
  let patch: Partial<TaskProfile> = {};

  for (const rule of RULES) {
    if (rule.pattern.test(description)) {
      patch = { ...patch, ...rule.patch };
      matched.push(rule.label);
      break; // first category rule wins; user can override
    }
  }
  for (const rule of MODALITY_RULES) {
    if (rule.pattern.test(description)) {
      patch = { ...patch, ...rule.patch };
      matched.push(rule.label);
      break;
    }
  }
  if (PRIVACY_RULE.pattern.test(description)) {
    patch = { ...patch, ...PRIVACY_RULE.patch };
    matched.push(PRIVACY_RULE.label);
  }
  if (BULK_RULE.pattern.test(description)) {
    patch = { ...patch, ...BULK_RULE.patch };
    matched.push(BULK_RULE.label);
  }
  const tokens = pageEstimate(description);
  if (tokens != null) {
    patch = { ...patch, contextNeededTokens: tokens };
    matched.push('document size');
  }

  return { patch, matched };
}
