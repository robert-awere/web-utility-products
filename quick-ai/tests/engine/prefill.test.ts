import { describe, expect, it } from 'vitest';
import { prefillFromDescription } from '../../src/engine/prefill';

describe('prefillFromDescription', () => {
  it('detects exact math', () => {
    const p = prefillFromDescription('I need to sum a column of numbers exactly');
    expect(p.patch.category).toBe('math_exact');
  });

  it('detects automation with scheduling', () => {
    const p = prefillFromDescription('Monitor a website every day for price changes');
    expect(p.patch.category).toBe('automation');
    expect(p.patch.autonomy).toBe('scheduled');
  });

  it('estimates document size from page counts', () => {
    const p = prefillFromDescription('Analyze a 600-page technical specification with diagrams');
    expect(p.patch.contextNeededTokens).toBe(480_000);
    expect(p.patch.modalities).toContain('diagram');
  });

  it('detects bulk volume', () => {
    const p = prefillFromDescription('Extract fields from 100,000 invoices');
    expect(p.patch.scale).toBe('bulk');
    expect(p.patch.category).toBe('extraction');
  });

  it('flags confidential data as sensitive privacy', () => {
    const p = prefillFromDescription('Summarize a confidential internal strategy document');
    expect(p.patch.privacy).toBe('sensitive');
  });

  it('returns an empty patch for unmatched descriptions', () => {
    const p = prefillFromDescription('zzz qqq');
    expect(Object.keys(p.patch)).toHaveLength(0);
    expect(p.matched).toHaveLength(0);
  });
});
