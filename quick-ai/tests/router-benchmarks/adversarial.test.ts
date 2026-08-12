/**
 * ADVERSARIAL CHECKS (build spec §13):
 *  1. Premium bias — an expensive model must not win unnecessarily.
 *  2. Counterexample — rules must not over-correct (quality_first may pick premium).
 *  3. Close call — near-equal top options must reduce confidence.
 * Plus explainability invariants: every recommendation explains itself.
 */

import { describe, expect, it } from 'vitest';
import { MODEL_REGISTRY } from '../../src/data/registry';
import { route } from '../../src/engine/router';
import { defaultTaskProfile, type TaskCategory, type TaskProfile } from '../../src/domain/task';

function task(overrides: Partial<TaskProfile>): TaskProfile {
  return { ...defaultTaskProfile(overrides.description ?? 'adversarial task'), ...overrides };
}

describe('Premium bias test', () => {
  const simpleCategories: TaskCategory[] = ['writing', 'classification', 'extraction', 'summarization', 'translation'];

  it.each(simpleCategories)('simple %s task never lands on a frontier model at balanced budget', (category) => {
    const r = route(
      task({ category, complexity: 'simple', reasoningDepth: 'light', answeredFields: ['category', 'complexity'] }),
      MODEL_REGISTRY,
    );
    expect(r.kind).toBe('recommendation');
    if (r.kind === 'recommendation') {
      expect(r.winner.model.reasoning.value).not.toBe('FRONTIER');
      expect(r.winner.cost).not.toBeNull();
      expect(r.winner.cost!).toBeLessThan(5);
    }
  });

  it('a cheaper model with the same fit always outranks a pricier one', () => {
    const r = route(
      task({ category: 'writing', complexity: 'moderate', answeredFields: ['category', 'complexity'] }),
      MODEL_REGISTRY,
    );
    if (r.kind !== 'recommendation') throw new Error('expected recommendation');
    const sameFit = r.allEvaluations.filter((e) => e.fit === r.winner.fit && e.cost != null);
    for (const e of sameFit) {
      expect(e.cost!).toBeGreaterThanOrEqual(r.winner.cost!);
    }
  });
});

describe('Counterexample test — rules must not over-correct', () => {
  it('quality_first on a hard task allows a frontier model to win', () => {
    const r = route(
      task({
        category: 'analysis',
        complexity: 'frontier',
        reasoningDepth: 'deep',
        budget: 'quality_first',
        answeredFields: ['category', 'complexity', 'budget'],
      }),
      MODEL_REGISTRY,
    );
    if (r.kind !== 'recommendation') throw new Error('expected recommendation');
    expect(r.winner.model.reasoning.value).toBe('FRONTIER');
  });

  it('the over-capability penalty does not block premium models when nothing cheaper fits', () => {
    // Frontier-complexity task: only frontier models are adequate; the
    // penalty must not push the router into recommending an inadequate model.
    const r = route(
      task({ category: 'coding', complexity: 'frontier', reasoningDepth: 'deep', answeredFields: ['category', 'complexity'] }),
      MODEL_REGISTRY,
    );
    if (r.kind !== 'recommendation') throw new Error('expected recommendation');
    expect(r.winner.model.coding.value).toBe('FRONTIER');
  });
});

describe('Close-call test', () => {
  it('confidence drops below HIGH when the top two options are nearly equal', () => {
    // Moderate writing: several MEDIUM/HIGH models cluster tightly on cost.
    const r = route(
      task({ category: 'writing', complexity: 'simple', answeredFields: ['category', 'complexity'] }),
      MODEL_REGISTRY,
    );
    if (r.kind !== 'recommendation') throw new Error('expected recommendation');
    const [first, second] = r.allEvaluations;
    if (
      first && second && first.fit === second.fit &&
      first.cost != null && second.cost != null &&
      Math.abs(first.cost - second.cost) <= 0.25 * Math.max(first.cost, second.cost)
    ) {
      expect(r.confidence.level).not.toBe('HIGH');
      expect(r.confidence.factors.join(' ')).toMatch(/nearly equivalent/);
    }
  });
});

describe('Explainability invariants', () => {
  const profiles: Partial<TaskProfile>[] = [
    { category: 'coding', complexity: 'complex', reasoningDepth: 'deep' },
    { category: 'classification', complexity: 'simple' },
    { category: 'research', complexity: 'moderate', toolRequirements: ['web'] },
    { category: 'summarization', complexity: 'moderate', privacy: 'sensitive' },
  ];

  it.each(profiles.map((p, i) => [i, p] as const))('recommendation %i exposes why-won, alternatives, and confidence factors', (_i, p) => {
    const r = route(task({ ...p, answeredFields: ['category'] }), MODEL_REGISTRY);
    expect(r.kind).toBe('recommendation');
    if (r.kind !== 'recommendation') return;
    expect(r.whyWon.length).toBeGreaterThan(0);
    expect(r.confidence.factors.length).toBeGreaterThan(0);
    expect(r.workflow.length).toBeGreaterThan(0);
    for (const alt of r.alternatives) {
      expect(alt.whyLost.length).toBeGreaterThan(0);
    }
  });

  it('no-AI outcomes also explain themselves', () => {
    const r = route(task({ category: 'validation', answeredFields: ['category'] }), MODEL_REGISTRY);
    expect(r.kind).toBe('no_ai');
    if (r.kind === 'no_ai') {
      expect(r.reason.length).toBeGreaterThan(10);
      expect(r.suggestion.length).toBeGreaterThan(10);
    }
  });
});
