import { describe, expect, it } from 'vitest';
import { MODEL_REGISTRY } from '../../src/data/registry';
import { diagnoseCost, type UsageProfile } from '../../src/engine/costleak';

function usage(overrides: Partial<UsageProfile>): UsageProfile {
  return {
    currentModelId: 'claude-sonnet-5',
    taskCategory: 'writing',
    taskComplexity: 'moderate',
    inputSize: 'medium',
    outputSize: 'medium',
    systemPromptSize: 'small',
    repeatedContext: false,
    cachingEnabled: 'yes',
    sessions: 'short',
    agents: 'none',
    toolCalls: 'few',
    rag: 'none',
    ...overrides,
  };
}

describe('diagnoseCost', () => {
  it('flags premium model on routine work as HIGH, citing a concrete cheaper model', () => {
    const d = diagnoseCost(usage({ currentModelId: 'claude-fable-5', taskComplexity: 'simple', taskCategory: 'classification' }), MODEL_REGISTRY);
    const f = d.findings.find((x) => x.title.includes('Premium model'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
    expect(f!.evidence).toMatch(/% lower/);
  });

  it('flags repeated context without caching as HIGH', () => {
    const d = diagnoseCost(usage({ repeatedContext: true, cachingEnabled: 'no' }), MODEL_REGISTRY);
    const f = d.findings.find((x) => x.title.includes('no prompt caching'));
    expect(f).toBeDefined();
    expect(f!.severity).toBe('HIGH');
  });

  it('does not flag caching when it is already on', () => {
    const d = diagnoseCost(usage({ repeatedContext: true, cachingEnabled: 'yes' }), MODEL_REGISTRY);
    expect(d.findings.find((x) => x.title.includes('no prompt caching'))).toBeUndefined();
  });

  it('caching softens system-prompt and tool-call severities', () => {
    const withCache = diagnoseCost(usage({ systemPromptSize: 'large', toolCalls: 'many', cachingEnabled: 'yes' }), MODEL_REGISTRY);
    const noCache = diagnoseCost(usage({ systemPromptSize: 'large', toolCalls: 'many', cachingEnabled: 'no' }), MODEL_REGISTRY);
    expect(withCache.findings.find((f) => f.title.includes('system prompt'))!.severity).toBe('LOW');
    expect(noCache.findings.find((f) => f.title.includes('system prompt'))!.severity).toBe('MEDIUM');
  });

  it('proposes a cheaper architecture only with >=2 substantive findings', () => {
    const many = diagnoseCost(
      usage({ currentModelId: 'claude-opus-5', taskComplexity: 'simple', repeatedContext: true, cachingEnabled: 'no', sessions: 'long', rag: 'whole_documents' }),
      MODEL_REGISTRY,
    );
    expect(many.cheaperArchitecture).not.toBeNull();
    const few = diagnoseCost(usage({}), MODEL_REGISTRY);
    expect(few.cheaperArchitecture).toBeNull();
  });

  it('is honest when nothing looks wrong', () => {
    const d = diagnoseCost(usage({ currentModelId: 'gpt-5.6-luna', taskComplexity: 'simple', taskCategory: 'classification' }), MODEL_REGISTRY);
    expect(d.findings).toHaveLength(0);
    expect(d.allClear).toMatch(/no major leak|Nothing/i);
  });

  it('orders findings by severity', () => {
    const d = diagnoseCost(
      usage({ currentModelId: 'claude-fable-5', taskComplexity: 'simple', taskCategory: 'classification', repeatedContext: true, cachingEnabled: 'no', outputSize: 'long', sessions: 'long' }),
      MODEL_REGISTRY,
    );
    const sevs = d.findings.map((f) => f.severity);
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    for (let i = 1; i < sevs.length; i++) {
      expect(order[sevs[i]!]).toBeGreaterThanOrEqual(order[sevs[i - 1]!]);
    }
  });

  it('every finding carries evidence and an action', () => {
    const d = diagnoseCost(
      usage({ currentModelId: 'claude-opus-5', taskComplexity: 'trivial', repeatedContext: true, cachingEnabled: 'unknown', agents: 'multi', toolCalls: 'many', rag: 'whole_documents', sessions: 'long', systemPromptSize: 'large' }),
      MODEL_REGISTRY,
    );
    expect(d.findings.length).toBeGreaterThanOrEqual(5);
    for (const f of d.findings) {
      expect(f.evidence.length).toBeGreaterThan(10);
      expect(f.action.length).toBeGreaterThan(10);
    }
  });
});
