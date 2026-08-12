/**
 * Model Downgrader tests — default bias: the least expensive option that
 * reliably satisfies the task. Includes the honest inverse (upgrade) and
 * the split-workflow escalation pattern for bulk work.
 */

import { describe, expect, it } from 'vitest';
import { MODEL_REGISTRY, getModel } from '../../src/data/registry';
import { downgrade } from '../../src/engine/downgrader';
import { defaultTaskProfile, type TaskProfile } from '../../src/domain/task';

function task(overrides: Partial<TaskProfile>): TaskProfile {
  return { ...defaultTaskProfile(overrides.description ?? 'test'), ...overrides, answeredFields: ['category', 'complexity'] };
}

describe('downgrade verdicts', () => {
  it('frontier model on a simple task -> downgrade with real savings', () => {
    const d = downgrade(task({ category: 'classification', complexity: 'simple', reasoningDepth: 'light' }), getModel('claude-opus-5'), MODEL_REGISTRY);
    expect(d.verdict).toBe('downgrade');
    expect(d.recommended).not.toBeNull();
    expect(d.savingsPct).not.toBeNull();
    expect(d.savingsPct!).toBeGreaterThanOrEqual(20);
    expect(d.recommended!.cost!).toBeLessThan(d.current!.cost!);
  });

  it('already-cheapest adequate model -> keep', () => {
    const d = downgrade(task({ category: 'classification', complexity: 'simple', reasoningDepth: 'light' }), getModel('gpt-5.6-luna'), MODEL_REGISTRY);
    expect(d.verdict).toBe('keep');
  });

  it('deterministic task -> drop the model entirely', () => {
    const d = downgrade(task({ category: 'math_exact', complexity: 'trivial' }), getModel('claude-opus-5'), MODEL_REGISTRY);
    expect(d.verdict).toBe('use_deterministic_code');
    expect(d.savingsPct).toBe(100);
  });

  it('current model too weak for the task -> honest upgrade, not a downgrade', () => {
    const d = downgrade(task({ category: 'coding', complexity: 'complex', reasoningDepth: 'deep' }), getModel('gemini-3.5-flash-lite'), MODEL_REGISTRY);
    expect(d.verdict).toBe('upgrade');
    expect(d.recommended).not.toBeNull();
    expect(d.reasons.some((r) => r.sign === '-')).toBe(true);
  });

  it('bulk work where only acceptable-fit models are cheaper -> split workflow with escalation', () => {
    const d = downgrade(
      task({ category: 'analysis', complexity: 'complex', reasoningDepth: 'deep', reliability: 'critical', scale: 'bulk' }),
      getModel('claude-opus-5'),
      MODEL_REGISTRY,
    );
    expect(d.verdict).toBe('split_workflow');
    expect(d.reasons.map((r) => r.text).join(' ')).toMatch(/escalat/i);
  });
});

describe('downgrader honesty invariants', () => {
  it('never recommends a model with worse than STRONG fit as a plain downgrade', () => {
    const profiles: Partial<TaskProfile>[] = [
      { category: 'writing', complexity: 'simple' },
      { category: 'coding', complexity: 'moderate' },
      { category: 'analysis', complexity: 'complex', reasoningDepth: 'deep' },
    ];
    for (const p of profiles) {
      for (const m of MODEL_REGISTRY) {
        const d = downgrade(task(p), m, MODEL_REGISTRY);
        if (d.verdict === 'downgrade') {
          expect(['STRONG', 'BEST_FIT']).toContain(d.recommended!.fit);
        }
      }
    }
  });

  it('every outcome carries reasons and confidence factors', () => {
    const d = downgrade(task({ category: 'writing', complexity: 'moderate' }), getModel('gpt-5.6-sol'), MODEL_REGISTRY);
    expect(d.reasons.length).toBeGreaterThan(0);
    expect(d.confidence.factors.length).toBeGreaterThan(0);
  });
});
