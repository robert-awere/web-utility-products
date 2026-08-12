/**
 * Live freshness recomputation — a deployed registry must degrade honestly
 * over time, and never get fresher on its own.
 */

import { describe, expect, it } from 'vitest';
import { MODEL_REGISTRY } from '../../src/data/registry';
import { refreshFreshness } from '../../src/domain/model';

describe('refreshFreshness', () => {
  it('is a no-op at the data-entry date', () => {
    const refreshed = refreshFreshness(MODEL_REGISTRY, '2026-08-12');
    for (let i = 0; i < MODEL_REGISTRY.length; i++) {
      expect(refreshed[i]!.inputCost.freshness).toBe(MODEL_REGISTRY[i]!.inputCost.freshness);
    }
  });

  it('degrades everything dated to STALE after long enough', () => {
    const refreshed = refreshFreshness(MODEL_REGISTRY, '2027-06-01');
    for (const m of refreshed) {
      if (m.inputCost.freshness !== 'UNKNOWN') {
        expect(m.inputCost.freshness).toBe('STALE');
      }
    }
  });

  it('never upgrades a stored freshness cap (secondary-source AGING stays AGING even when recently verified)', () => {
    // GPT pricing was verified 2026-08-12 — by age alone that's FRESH one day
    // later, but the stored secondary-source cap is AGING and must hold.
    const refreshed = refreshFreshness(MODEL_REGISTRY, '2026-08-13');
    const sol = refreshed.find((m) => m.id === 'gpt-5.6-sol')!;
    expect(sol.inputCost.freshness).toBe('AGING');
  });

  it('leaves UNKNOWN facts untouched', () => {
    const refreshed = refreshFreshness(MODEL_REGISTRY, '2027-06-01');
    const sol = refreshed.find((m) => m.id === 'gpt-5.6-sol')!;
    expect(sol.contextLimit.freshness).toBe('UNKNOWN');
  });
});
