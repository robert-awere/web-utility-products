/**
 * AGENT OR CHAT? — deterministic classifier over the shared TaskProfile.
 *
 * Rule (build spec §3B): do NOT recommend an agent unless autonomy or repeated
 * tool use creates real value. The classifier is biased toward the simplest
 * interaction mode that does the job — chat beats agent, a script beats both.
 */

import type { Reason } from '../domain/result';
import type { TaskProfile } from '../domain/task';
import { checkNoAi } from './noai';

export type InteractionMode =
  | 'standard_chat'
  | 'reasoning_chat'
  | 'coding_agent'
  | 'research_agent'
  | 'browser_web_agent'
  | 'scheduled_agent'
  | 'workflow_automation'
  | 'multi_agent_workflow'
  | 'traditional_software'
  | 'no_ai_needed';

export interface InteractionClassification {
  mode: InteractionMode;
  headline: string;
  why: Reason[];
  /** Present when the user might expect an agent but doesn't need one. */
  agentGuard: string | null;
}

const MODE_HEADLINES: Record<InteractionMode, string> = {
  standard_chat: 'Standard chat — just ask.',
  reasoning_chat: 'Reasoning chat — one deep conversation, no agent.',
  coding_agent: 'Coding agent — it edits, runs, and verifies for you.',
  research_agent: 'Research agent — it searches, reads, and synthesizes.',
  browser_web_agent: 'Browser/web agent — it operates the web for you.',
  scheduled_agent: 'Scheduled agent — it runs unattended on a cadence.',
  workflow_automation: 'Workflow automation — a pipeline, with AI only where judgment is needed.',
  multi_agent_workflow: 'Multi-agent workflow — parallel workers under a coordinator.',
  traditional_software: 'Traditional software — no AI needed.',
  no_ai_needed: 'No AI needed.',
};

const AGENT_MODES: ReadonlySet<InteractionMode> = new Set([
  'coding_agent',
  'research_agent',
  'browser_web_agent',
  'scheduled_agent',
  'multi_agent_workflow',
]);

export function isAgentMode(mode: InteractionMode): boolean {
  return AGENT_MODES.has(mode);
}

export function classifyInteraction(task: TaskProfile): InteractionClassification {
  const why: Reason[] = [];

  // 1. Deterministic tasks don't need AI at all — same gate as the router.
  const noAi = checkNoAi(task);
  if (noAi) {
    return {
      mode: 'traditional_software',
      headline: MODE_HEADLINES.traditional_software,
      why: [
        { sign: '+', text: noAi.reason },
        { sign: '+', text: noAi.suggestion },
      ],
      agentGuard: 'An agent here would add cost and a failure rate to a problem ordinary code solves exactly.',
    };
  }

  const usesTools = task.toolRequirements.length > 0;
  const unattended = task.autonomy === 'scheduled' || task.autonomy === 'continuous';
  const multiStep = task.autonomy === 'multi_step';
  const simpleWork = task.complexity === 'trivial' || task.complexity === 'simple';

  // 2. Unattended, recurring work.
  if (unattended) {
    if (simpleWork && task.reasoningDepth !== 'deep') {
      why.push({ sign: '+', text: 'runs unattended on a schedule — that part is a plain scheduled job (cron), not an agent' });
      why.push({ sign: '+', text: 'the per-run work is simple, so most steps can be deterministic code' });
      why.push({ sign: '△', text: 'add a single small-model AI step only for any judgment the script cannot encode' });
      return {
        mode: 'workflow_automation',
        headline: MODE_HEADLINES.workflow_automation,
        why,
        agentGuard: 'A full agent is over-engineering here: agents earn their cost when each run needs open-ended judgment, and these runs do not.',
      };
    }
    why.push({ sign: '+', text: 'runs unattended on a schedule' });
    why.push({ sign: '+', text: 'each run needs enough judgment that scripted steps would not cover it' });
    if (usesTools) why.push({ sign: '+', text: 'uses tools repeatedly across the run' });
    return { mode: 'scheduled_agent', headline: MODE_HEADLINES.scheduled_agent, why, agentGuard: null };
  }

  // 3. Multi-step autonomous work (one attended run).
  if (multiStep) {
    // Bulk structured work is a pipeline, not a free-roaming agent.
    if (task.scale === 'bulk' && (task.outputType === 'structured' || simpleWork)) {
      why.push({ sign: '+', text: 'thousands of near-identical items — the loop, retries, and bookkeeping belong in code' });
      why.push({ sign: '+', text: 'AI does one bounded step per item; the pipeline does the rest' });
      return {
        mode: 'workflow_automation',
        headline: MODE_HEADLINES.workflow_automation,
        why,
        agentGuard: 'One agent free-running over thousands of items is slower, costlier, and harder to audit than a pipeline with an AI step.',
      };
    }
    // Genuinely parallel hard work under a coordinator.
    if ((task.complexity === 'complex' || task.complexity === 'frontier') && task.scale === 'bulk') {
      why.push({ sign: '+', text: 'the work is hard AND fans out across independent pieces — parallel workers pay off' });
      return { mode: 'multi_agent_workflow', headline: MODE_HEADLINES.multi_agent_workflow, why, agentGuard: null };
    }
    if (task.category === 'coding') {
      why.push({ sign: '+', text: 'multi-step coding work: edit, run, test, fix — repeated tool use is the value' });
      return { mode: 'coding_agent', headline: MODE_HEADLINES.coding_agent, why, agentGuard: null };
    }
    if (task.category === 'research') {
      why.push({ sign: '+', text: 'multi-source research: search, read, cross-check, synthesize — repeated tool use is the value' });
      return { mode: 'research_agent', headline: MODE_HEADLINES.research_agent, why, agentGuard: null };
    }
    if (task.toolRequirements.includes('web')) {
      why.push({ sign: '+', text: 'the task is operating websites/web services step by step' });
      return { mode: 'browser_web_agent', headline: MODE_HEADLINES.browser_web_agent, why, agentGuard: null };
    }
    // Multi-step but no tool leverage: a conversation still does it.
    why.push({ sign: '+', text: 'multiple steps, but no repeated tool use — a conversation covers this without agent overhead' });
    return {
      mode: task.reasoningDepth === 'deep' || !simpleWork ? 'reasoning_chat' : 'standard_chat',
      headline: task.reasoningDepth === 'deep' || !simpleWork ? MODE_HEADLINES.reasoning_chat : MODE_HEADLINES.standard_chat,
      why,
      agentGuard: 'An agent only pays off when it must act (run code, browse, call APIs) between reasoning steps. This task is all reasoning, no acting.',
    };
  }

  // 4. No autonomy: chat. Never an agent (spec rule).
  if (task.reasoningDepth === 'deep' || task.complexity === 'complex' || task.complexity === 'frontier') {
    why.push({ sign: '+', text: 'needs deep reasoning, but it is a single exchange — no autonomy required' });
    return {
      mode: 'reasoning_chat',
      headline: MODE_HEADLINES.reasoning_chat,
      why,
      agentGuard: 'No agent needed: nothing here requires the AI to take actions on its own.',
    };
  }
  why.push({ sign: '+', text: 'a single question-and-answer exchange covers this' });
  return {
    mode: 'standard_chat',
    headline: MODE_HEADLINES.standard_chat,
    why,
    agentGuard: 'No agent needed: agents add cost and moving parts, and this task gains nothing from them.',
  };
}
