import { describe, expect, it } from 'vitest';
import { MODEL_REGISTRY } from '../../src/data/registry';
import { assessFile, type FileFacts } from '../../src/engine/inspect';

function facts(overrides: Partial<FileFacts>): FileFacts {
  return {
    name: 'file.txt',
    sizeBytes: 10_000,
    kind: 'text',
    textChars: null,
    pdfPages: null,
    pdfHasImages: false,
    pdfLikelyScanned: false,
    hasTables: false,
    ...overrides,
  };
}

describe('assessFile', () => {
  it('small text file -> direct processing, measured token estimate', () => {
    const a = assessFile(facts({ textChars: 8_000 }), MODEL_REGISTRY);
    expect(a.verdict).toBe('direct');
    expect(a.estTokens).toBe(2_000);
    expect(a.estBasis).toMatch(/measured locally/);
    expect(a.fittingModels.length).toBeGreaterThan(0);
  });

  it('scanned PDF -> preprocessing (OCR / vision) required', () => {
    const a = assessFile(facts({ name: 'scan.pdf', kind: 'pdf', pdfPages: 30, pdfHasImages: true, pdfLikelyScanned: true }), MODEL_REGISTRY);
    expect(a.verdict).toBe('preprocess');
    expect(a.preprocessing.join(' ')).toMatch(/OCR/);
    expect(a.recommendedClass).toMatch(/multimodal|vision/);
    expect(a.failureModes.join(' ')).toMatch(/reads almost nothing/);
  });

  it('600-page PDF with figures -> long-context multimodal, page-based estimate', () => {
    const a = assessFile(facts({ name: 'spec.pdf', kind: 'pdf', pdfPages: 600, pdfHasImages: true }), MODEL_REGISTRY);
    expect(a.estTokens).toBe(480_000);
    expect(a.recommendedClass).toMatch(/long-context multimodal/);
    // Models with verified 1M windows fit; 200K models don't.
    expect(a.fittingModels).toContain('Claude Sonnet 5');
    expect(a.fittingModels).not.toContain('Claude Haiku 4.5');
  });

  it('document exceeding every verified context window -> chunk/retrieval verdict', () => {
    const a = assessFile(facts({ name: 'corpus.txt', textChars: 8_000_000 * 4 }), MODEL_REGISTRY);
    expect(a.verdict).toBe('chunk');
    expect(a.fittingModels).toHaveLength(0);
    expect(a.workflow.join(' ')).toMatch(/chunk|retriev/i);
  });

  it('tables are flagged as an extraction-loss risk', () => {
    const a = assessFile(facts({ name: 'data.csv', kind: 'csv', textChars: 40_000, hasTables: true }), MODEL_REGISTRY);
    expect(a.failureModes.join(' ')).toMatch(/[Tt]ables/);
  });

  it('unknown format -> impractical with conversion advice', () => {
    const a = assessFile(facts({ name: 'file.xyz', kind: 'unknown' }), MODEL_REGISTRY);
    expect(a.verdict).toBe('impractical');
    expect(a.preprocessing.join(' ')).toMatch(/[Cc]onvert/);
  });

  it('image -> vision requirement stated; no fake token estimate', () => {
    const a = assessFile(facts({ name: 'photo.png', kind: 'image' }), MODEL_REGISTRY);
    expect(a.estTokens).toBeNull();
    expect(a.failureModes.join(' ')).toMatch(/vision/);
  });
});
