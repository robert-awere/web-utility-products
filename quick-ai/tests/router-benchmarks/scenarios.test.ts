/**
 * ROUTER BENCHMARKS — fixed scenarios A–H (see build spec §12).
 * These assert *properties* of the recommendation, not exact model names,
 * so registry updates don't silently rot the suite — unless behavior
 * genuinely regresses.
 */

import { describe, expect, it } from 'vitest';
import { MODEL_REGISTRY } from '../../src/data/registry';
import { tierRank } from '../../src/domain/model';
import { route } from '../../src/engine/router';
import { defaultTaskProfile, type TaskProfile } from '../../src/domain/task';

function task(overrides: Partial<TaskProfile>): TaskProfile {
  return { ...defaultTaskProfile(overrides.description ?? 'benchmark task'), ...overrides };
}

function expectRecommendation(outcome: ReturnType<typeof route>) {
  expect(outcome.kind).toBe('recommendation');
  if (outcome.kind !== 'recommendation') throw new Error('unreachable');
  return outcome;
}

describe('Benchmark A — simple sentiment classification', () => {
  const profile = task({
    description: 'Classify customer reviews as positive/negative/neutral',
    category: 'classification',
    complexity: 'simple',
    reasoningDepth: 'light',
    scale: 'recurring',
    outputType: 'decision',
    answeredFields: ['category', 'complexity', 'scale'],
  });

  it('recommends a small/cheap model, never a frontier model', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.winner.model.reasoning.value).not.toBe('FRONTIER');
    expect(r.winner.cost).not.toBeNull();
    expect(r.winner.cost!).toBeLessThan(2);
  });
});

describe('Benchmark B — 600-page technical specification with diagrams', () => {
  const profile = task({
    description: 'Analyze a 600-page technical specification including diagrams',
    category: 'analysis',
    complexity: 'complex',
    reasoningDepth: 'deep',
    contextNeededTokens: 480_000,
    modalities: ['text', 'diagram'],
    answeredFields: ['category', 'complexity', 'contextNeededTokens', 'modalities'],
  });

  it('recommends a strong-reasoning multimodal model whose context fits the document', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(tierRank(r.winner.model.reasoning.value)).toBeGreaterThanOrEqual(tierRank('HIGH'));
    const limit = r.winner.model.contextLimit.value;
    expect(limit).not.toBeNull();
    expect(limit!).toBeGreaterThanOrEqual(480_000);
    const mods = r.winner.model.supportedModalities.value;
    expect(mods.includes('diagram') || mods.includes('image')).toBe(true);
  });

  it('disqualifies models that cannot see diagrams or fit the context', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    const haiku = r.allEvaluations.find((e) => e.model.id === 'claude-haiku-4-5');
    expect(haiku).toBeDefined();
    expect(haiku!.fit).not.toBe('STRONG');
    expect(haiku!.fit).not.toBe('BEST_FIT');
  });
});

describe('Benchmark C — daily website price monitoring', () => {
  const profile = task({
    description: 'Check a website every day and record price changes',
    category: 'automation',
    complexity: 'simple',
    reasoningDepth: 'light',
    autonomy: 'scheduled',
    toolRequirements: ['web'],
    scale: 'recurring',
    answeredFields: ['category', 'autonomy', 'toolRequirements', 'scale'],
  });

  it('recommends an automation-capable option with tool support and an agent workflow', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.winner.model.supportsTools.value).toBe(true);
    expect(tierRank(r.winner.model.agentFit.value)).toBeGreaterThanOrEqual(tierRank('MEDIUM'));
    expect(r.workflow.join(' ')).toMatch(/done|checkpoint/i);
  });

  it('does not burn a frontier model on simple recurring monitoring', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.winner.model.reasoning.value).not.toBe('FRONTIER');
  });
});

describe('Benchmark D — grammar correction', () => {
  const profile = task({
    description: 'Fix grammar and typos in short emails',
    category: 'writing',
    complexity: 'simple',
    reasoningDepth: 'none',
    answeredFields: ['category', 'complexity'],
  });

  it('recommends a cheap/simple model', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.winner.cost).not.toBeNull();
    expect(r.winner.cost!).toBeLessThan(2);
    expect(r.winner.model.writing.value).not.toBe('FRONTIER');
  });
});

describe('Benchmark E — complex regulated software architecture', () => {
  const profile = task({
    description: 'Design the architecture for a regulated financial trading system',
    category: 'coding',
    complexity: 'complex',
    reasoningDepth: 'deep',
    reliability: 'critical',
    answeredFields: ['category', 'complexity', 'reasoningDepth', 'reliability'],
  });

  it('recommends a high-reasoning option with capability margin', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.winner.model.coding.value).toBe('FRONTIER');
  });

  it('still surfaces a cheaper acceptable option', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.cheaperOption).not.toBeNull();
    expect(r.cheaperOption!.cost!).toBeLessThan(r.winner.cost!);
  });
});

describe('Benchmark F — extract fields from 100,000 invoices', () => {
  const profile = task({
    description: 'Extract vendor, date, and total from 100,000 scanned invoices',
    category: 'extraction',
    complexity: 'simple',
    reasoningDepth: 'light',
    modalities: ['text', 'scanned_page'],
    scale: 'bulk',
    outputType: 'structured',
    answeredFields: ['category', 'modalities', 'scale', 'outputType'],
  });

  it('recommends a pipeline with a small model that can read scanned pages', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    expect(r.winner.model.reasoning.value).not.toBe('FRONTIER');
    expect(r.winner.model.supportedModalities.value).toContain('scanned_page');
    const wf = r.workflow.join(' ');
    expect(wf).toMatch(/pilot|sample/i);
    expect(wf).toMatch(/OCR|extraction quality/i);
    expect(wf).toMatch(/batch/i);
  });

  it('penalizes frontier models on bulk-scale simple extraction', () => {
    const r = expectRecommendation(route(profile, MODEL_REGISTRY));
    const fable = r.allEvaluations.find((e) => e.model.id === 'claude-fable-5');
    expect(fable).toBeDefined();
    expect(['WEAK', 'NOT_RECOMMENDED', 'ACCEPTABLE']).toContain(fable!.fit);
    expect(fable!.reasons.some((x) => x.sign === '-' && /more capability|bulk/i.test(x.text))).toBe(true);
  });
});

describe('Benchmark G — exact arithmetic', () => {
  const profile = task({
    description: 'Sum a column of 2,000 numbers exactly',
    category: 'math_exact',
    complexity: 'trivial',
    reasoningDepth: 'none',
    answeredFields: ['category'],
  });

  it('says: do not use AI for this', () => {
    const r = route(profile, MODEL_REGISTRY);
    expect(r.kind).toBe('no_ai');
    if (r.kind === 'no_ai') {
      expect(r.suggestion).toMatch(/calculator|spreadsheet|code/i);
    }
  });
});

describe('Benchmark H — confidential internal document', () => {
  const base = {
    description: 'Summarize a confidential internal strategy document',
    category: 'summarization' as const,
    complexity: 'moderate' as const,
    answeredFields: ['category', 'complexity', 'privacy'],
  };

  it('strict privacy forces a self-hosted recommendation', () => {
    const r = expectRecommendation(route(task({ ...base, privacy: 'strict_local' }), MODEL_REGISTRY));
    expect(r.winner.model.privacyCharacteristics.canRunLocally).toBe(true);
    // Every hosted API model must be disqualified.
    for (const e of r.allEvaluations) {
      if (!e.model.privacyCharacteristics.canRunLocally) {
        expect(e.fit).toBe('NOT_RECOMMENDED');
      }
    }
  });

  it('the privacy constraint materially changes the outcome vs a standard task', () => {
    const strict = expectRecommendation(route(task({ ...base, privacy: 'strict_local' }), MODEL_REGISTRY));
    const standard = expectRecommendation(route(task({ ...base, privacy: 'standard' }), MODEL_REGISTRY));
    expect(strict.winner.model.id).not.toBe(standard.winner.model.id);
  });

  it('sensitive (not strict) privacy surfaces a data-handling warning', () => {
    const r = expectRecommendation(route(task({ ...base, privacy: 'sensitive' }), MODEL_REGISTRY));
    if (!r.winner.model.privacyCharacteristics.canRunLocally) {
      expect(r.watchOut.some((x) => /data-handling|provider/i.test(x.text))).toBe(true);
    }
    const wf = r.workflow.join(' ');
    expect(wf).toMatch(/data-retention|terms/i);
  });
});
