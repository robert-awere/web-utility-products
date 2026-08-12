/**
 * Confidence engine unit tests — the freshness gate must actually gate:
 * stale/unknown data lowers confidence; fresh data allows HIGH.
 */

import { describe, expect, it } from 'vitest';
import { getModel } from '../../src/data/registry';
import { classifyFreshness, type Fact, type Freshness, type ModelProfile } from '../../src/domain/model';
import type { ModelEvaluation } from '../../src/domain/result';
import { computeConfidence } from '../../src/engine/confidence';
import { defaultTaskProfile } from '../../src/domain/task';

function withFreshness(model: ModelProfile, freshness: Freshness): ModelProfile {
  const stamp = <T>(f: Fact<T>): Fact<T> => ({ ...f, freshness });
  return {
    ...model,
    inputCost: stamp(model.inputCost),
    outputCost: stamp(model.outputCost),
    contextLimit: stamp(model.contextLimit),
    supportedModalities: stamp(model.supportedModalities),
    supportsTools: stamp(model.supportsTools),
  };
}

function evalOf(model: ModelProfile): ModelEvaluation {
  return { model, fit: 'STRONG', reasons: [], disqualified: false, cost: 5 };
}

const wellSpecifiedTask = {
  ...defaultTaskProfile('test'),
  answeredFields: ['category', 'complexity', 'privacy', 'budget'],
};

describe('freshness gate', () => {
  it('FRESH decisive facts allow HIGH confidence', () => {
    const winner = evalOf(withFreshness(getModel('claude-sonnet-5'), 'FRESH'));
    const c = computeConfidence(wellSpecifiedTask, winner, null);
    expect(c.level).toBe('HIGH');
  });

  it('AGING decisive facts cap confidence at MEDIUM', () => {
    const winner = evalOf(withFreshness(getModel('claude-sonnet-5'), 'AGING'));
    const c = computeConfidence(wellSpecifiedTask, winner, null);
    expect(c.level).toBe('MEDIUM');
    expect(c.factors.join(' ')).toMatch(/verified over a month ago/);
  });

  it('STALE decisive facts drop confidence to LOW with disclosure', () => {
    const winner = evalOf(withFreshness(getModel('claude-sonnet-5'), 'STALE'));
    const c = computeConfidence(wellSpecifiedTask, winner, null);
    expect(c.level).toBe('LOW');
    expect(c.factors.join(' ')).toMatch(/stale or unverified/);
  });

  it('UNKNOWN decisive facts are treated like STALE', () => {
    const winner = evalOf(withFreshness(getModel('gpt-5.6-sol'), 'UNKNOWN'));
    const c = computeConfidence(wellSpecifiedTask, winner, null);
    expect(c.level).toBe('LOW');
  });
});

describe('ambiguity gate', () => {
  it('an under-specified task lowers confidence', () => {
    const winner = evalOf(withFreshness(getModel('claude-sonnet-5'), 'FRESH'));
    const vague = { ...defaultTaskProfile('help me'), answeredFields: [] };
    const c = computeConfidence(vague, winner, null);
    expect(c.level).not.toBe('HIGH');
    expect(c.factors.join(' ')).toMatch(/defaults/);
  });
});

describe('classifyFreshness', () => {
  it('classifies by age thresholds', () => {
    expect(classifyFreshness('2026-08-01', '2026-08-12')).toBe('FRESH');
    expect(classifyFreshness('2026-06-24', '2026-08-12')).toBe('AGING');
    expect(classifyFreshness('2026-01-01', '2026-08-12')).toBe('STALE');
    expect(classifyFreshness('garbage', '2026-08-12')).toBe('UNKNOWN');
  });
});
