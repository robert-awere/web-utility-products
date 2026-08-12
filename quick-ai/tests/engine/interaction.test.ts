/**
 * "Agent or Chat?" classifier tests — including the anti-agent-hype guard:
 * an agent is never recommended without autonomy or repeated tool use.
 */

import { describe, expect, it } from 'vitest';
import { classifyInteraction, isAgentMode } from '../../src/engine/interaction';
import { defaultTaskProfile, type TaskProfile } from '../../src/domain/task';

function task(overrides: Partial<TaskProfile>): TaskProfile {
  return { ...defaultTaskProfile(overrides.description ?? 'test'), ...overrides };
}

describe('chat modes', () => {
  it('simple question -> standard chat, with an explicit no-agent note', () => {
    const c = classifyInteraction(task({ category: 'conversation', complexity: 'simple', reasoningDepth: 'light' }));
    expect(c.mode).toBe('standard_chat');
    expect(c.agentGuard).toMatch(/agent/i);
  });

  it('deep one-shot analysis -> reasoning chat, not an agent', () => {
    const c = classifyInteraction(task({ category: 'analysis', complexity: 'complex', reasoningDepth: 'deep', autonomy: 'none' }));
    expect(c.mode).toBe('reasoning_chat');
    expect(isAgentMode(c.mode)).toBe(false);
  });

  it('multi-step pure-reasoning work stays a chat (no tool leverage)', () => {
    const c = classifyInteraction(task({ category: 'writing', complexity: 'moderate', autonomy: 'multi_step', toolRequirements: [] }));
    expect(isAgentMode(c.mode)).toBe(false);
    expect(c.agentGuard).not.toBeNull();
  });
});

describe('agent modes', () => {
  it('multi-step coding -> coding agent', () => {
    const c = classifyInteraction(task({ category: 'coding', complexity: 'complex', autonomy: 'multi_step', toolRequirements: ['code_execution'] }));
    expect(c.mode).toBe('coding_agent');
  });

  it('multi-source research -> research agent', () => {
    const c = classifyInteraction(task({ category: 'research', complexity: 'moderate', autonomy: 'multi_step', toolRequirements: ['web'] }));
    expect(c.mode).toBe('research_agent');
  });

  it('multi-step web operation -> browser/web agent', () => {
    const c = classifyInteraction(task({ category: 'other', complexity: 'moderate', autonomy: 'multi_step', toolRequirements: ['web'] }));
    expect(c.mode).toBe('browser_web_agent');
  });

  it('unattended judgment-heavy work -> scheduled agent', () => {
    const c = classifyInteraction(task({ category: 'analysis', complexity: 'complex', reasoningDepth: 'deep', autonomy: 'scheduled', toolRequirements: ['web'] }));
    expect(c.mode).toBe('scheduled_agent');
  });

  it('hard work fanning out across bulk items -> multi-agent workflow', () => {
    const c = classifyInteraction(task({ category: 'analysis', complexity: 'complex', autonomy: 'multi_step', scale: 'bulk', outputType: 'text', reasoningDepth: 'deep' }));
    expect(c.mode).toBe('multi_agent_workflow');
  });
});

describe('automation and no-AI modes', () => {
  it('simple scheduled monitoring -> workflow automation (cron + script), not an agent', () => {
    const c = classifyInteraction(task({ category: 'automation', complexity: 'simple', reasoningDepth: 'light', autonomy: 'scheduled', toolRequirements: ['web'], scale: 'recurring' }));
    expect(c.mode).toBe('workflow_automation');
    expect(c.agentGuard).toMatch(/over-engineering|agent/i);
  });

  it('bulk structured extraction -> pipeline, not a free-roaming agent', () => {
    const c = classifyInteraction(task({ category: 'extraction', complexity: 'simple', autonomy: 'multi_step', scale: 'bulk', outputType: 'structured' }));
    expect(c.mode).toBe('workflow_automation');
  });

  it('exact arithmetic -> traditional software', () => {
    const c = classifyInteraction(task({ category: 'math_exact', complexity: 'trivial' }));
    expect(c.mode).toBe('traditional_software');
  });
});

describe('anti-agent-hype invariant', () => {
  const categories: TaskProfile['category'][] = ['writing', 'coding', 'research', 'analysis', 'classification', 'extraction', 'summarization', 'conversation', 'other'];

  it.each(categories)('no autonomy + no tools never yields an agent (%s)', (category) => {
    for (const complexity of ['trivial', 'simple', 'moderate', 'complex', 'frontier'] as const) {
      const c = classifyInteraction(task({ category, complexity, autonomy: 'none', toolRequirements: [] }));
      expect(isAgentMode(c.mode)).toBe(false);
    }
  });

  it('every classification explains itself', () => {
    const samples: Partial<TaskProfile>[] = [
      { category: 'coding', autonomy: 'multi_step' },
      { category: 'conversation' },
      { category: 'automation', autonomy: 'scheduled' },
      { category: 'math_exact' },
    ];
    for (const s of samples) {
      const c = classifyInteraction(task(s));
      expect(c.why.length).toBeGreaterThan(0);
      expect(c.headline.length).toBeGreaterThan(5);
    }
  });
});
