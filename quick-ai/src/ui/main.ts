/** UI wiring — describe -> confirm ≤4 questions -> explained recommendation. */

import { MODEL_REGISTRY as STATIC_REGISTRY } from '../data/registry';
import { refreshFreshness } from '../domain/model';

/** Freshness recomputed for today's date, so a stale deploy tells the truth. */
const MODEL_REGISTRY = refreshFreshness(STATIC_REGISTRY, new Date().toISOString().slice(0, 10));
import { defaultTaskProfile, type Modality, type TaskCategory, type TaskProfile } from '../domain/task';
import { diagnoseCost, type UsageProfile } from '../engine/costleak';
import { assessFile } from '../engine/inspect';
import { extractFileFacts } from './filefacts';
import { downgrade } from '../engine/downgrader';
import { classifyInteraction } from '../engine/interaction';
import { prefillFromDescription } from '../engine/prefill';
import { route } from '../engine/router';
import { esc, renderClassification, renderCostDiagnosis, renderDowngrade, renderInspection, renderOutcome } from './render';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};

const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: 'writing', label: 'Writing / editing' },
  { value: 'coding', label: 'Coding' },
  { value: 'research', label: 'Research' },
  { value: 'analysis', label: 'Analysis of documents/data' },
  { value: 'summarization', label: 'Summarization' },
  { value: 'classification', label: 'Classification / labeling' },
  { value: 'extraction', label: 'Data extraction' },
  { value: 'translation', label: 'Translation' },
  { value: 'conversation', label: 'Chat / Q&A' },
  { value: 'automation', label: 'Automation / monitoring' },
  { value: 'math_exact', label: 'Exact calculation' },
  { value: 'exact_lookup', label: 'Exact lookup' },
  { value: 'simple_transform', label: 'Simple data transformation' },
  { value: 'validation', label: 'Rule-based validation' },
  { value: 'other', label: 'Something else' },
];

function populateCategories(select: HTMLSelectElement, selected: TaskCategory) {
  select.innerHTML = CATEGORY_OPTIONS.map(
    (o) => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`,
  ).join('');
}

let prefill: Partial<TaskProfile> = {};
type Tool = 'router' | 'agent' | 'downgrade' | 'cost' | 'inspect';
let activeTool: Tool = 'router';

function selectTool(tool: Tool) {
  activeTool = tool;
  for (const t of ['router', 'agent', 'downgrade', 'cost', 'inspect'] as const) {
    ($(`tab-${t}`) as HTMLButtonElement).setAttribute('aria-pressed', String(tool === t));
  }
  // Constraints (privacy/budget) influence model routing and the downgrader,
  // but not the agent-or-chat classification — never ask a question that
  // can't change the recommendation.
  $('fieldset-constraints').classList.toggle('hidden', tool === 'agent');
  $('fieldset-current-model').classList.toggle('hidden', tool !== 'downgrade');
  $('step-questions').classList.add('hidden');
  $('step-cost').classList.add('hidden');
  $('step-result').classList.add('hidden');
  // The file inspector needs no task description — show it immediately.
  $('step-inspect').classList.toggle('hidden', tool !== 'inspect');
  $('step-describe').classList.toggle('hidden', tool === 'inspect');
}

function modelOptions(): string {
  return MODEL_REGISTRY.map(
    (m, i) => `<option value="${esc(m.id)}"${i === 0 ? ' selected' : ''}>${esc(m.model)} (${esc(m.provider)})</option>`,
  ).join('');
}

function populateCurrentModels() {
  ($('q-current-model') as HTMLSelectElement).innerHTML = modelOptions();
  ($('qc-model') as HTMLSelectElement).innerHTML = modelOptions();
}

function startQuestions() {
  const description = ($('description') as HTMLTextAreaElement).value.trim();
  if (!description) {
    ($('description') as HTMLTextAreaElement).focus();
    return;
  }
  const suggestion = prefillFromDescription(description);
  prefill = { ...suggestion.patch, description };

  if (activeTool === 'cost') {
    populateCategories($('qc-category') as HTMLSelectElement, suggestion.patch.category ?? 'other');
    if (suggestion.patch.complexity && suggestion.patch.complexity !== 'frontier') {
      ($('qc-complexity') as HTMLSelectElement).value = suggestion.patch.complexity;
    }
    $('step-cost').classList.remove('hidden');
    $('step-questions').classList.add('hidden');
    $('step-result').classList.add('hidden');
    $('step-cost').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  populateCategories($('q-category') as HTMLSelectElement, suggestion.patch.category ?? 'other');
  if (suggestion.patch.complexity) ($('q-complexity') as HTMLSelectElement).value = suggestion.patch.complexity;
  if (suggestion.patch.privacy) ($('q-privacy') as HTMLSelectElement).value = suggestion.patch.privacy;
  if (suggestion.patch.scale) ($('q-scale') as HTMLSelectElement).value = suggestion.patch.scale;
  if (suggestion.patch.contextNeededTokens != null) {
    const sizeSel = $('q-size') as HTMLSelectElement;
    const t = suggestion.patch.contextNeededTokens;
    sizeSel.value = t > 1_000_000 ? '4000000' : t > 100_000 ? '480000' : '40000';
  }
  const mods = suggestion.patch.modalities ?? [];
  ($('q-images') as HTMLInputElement).checked = mods.includes('image') || mods.includes('diagram');
  ($('q-scans') as HTMLInputElement).checked = mods.includes('scanned_page');
  ($('q-agent') as HTMLInputElement).checked =
    suggestion.patch.autonomy === 'scheduled' || suggestion.patch.autonomy === 'multi_step';

  const note = $('prefill-note');
  if (suggestion.matched.length) {
    note.textContent = `Pre-filled from your description (${suggestion.matched.join(', ')}) — adjust anything that's off.`;
    note.classList.remove('hidden');
  } else {
    note.classList.add('hidden');
  }

  $('step-questions').classList.remove('hidden');
  $('step-result').classList.add('hidden');
  $('step-questions').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function collectProfile(): TaskProfile {
  const base = defaultTaskProfile(prefill.description ?? '');
  const answeredFields: string[] = ['category', 'complexity', 'reliability', 'privacy', 'budget'];

  const category = ($('q-category') as HTMLSelectElement).value as TaskCategory;
  const complexity = ($('q-complexity') as HTMLSelectElement).value as TaskProfile['complexity'];
  const reliability = ($('q-reliability') as HTMLSelectElement).value as TaskProfile['reliability'];
  const privacy = ($('q-privacy') as HTMLSelectElement).value as TaskProfile['privacy'];
  const budget = ($('q-budget') as HTMLSelectElement).value as TaskProfile['budget'];
  const sizeRaw = ($('q-size') as HTMLSelectElement).value;
  const scale = ($('q-scale') as HTMLSelectElement).value as TaskProfile['scale'];

  const modalities: Modality[] = ['text'];
  if (($('q-images') as HTMLInputElement).checked) modalities.push('image', 'diagram');
  if (($('q-scans') as HTMLInputElement).checked) modalities.push('scanned_page');

  const agent = ($('q-agent') as HTMLInputElement).checked;

  const reasoningDepth: TaskProfile['reasoningDepth'] =
    complexity === 'trivial' ? 'none'
    : complexity === 'simple' ? 'light'
    : complexity === 'moderate' ? 'moderate'
    : 'deep';

  return {
    ...base,
    ...prefill,
    category,
    complexity,
    reasoningDepth,
    reliability,
    privacy,
    budget,
    scale,
    modalities,
    contextNeededTokens: sizeRaw ? Number(sizeRaw) : (prefill.contextNeededTokens ?? null),
    autonomy: agent ? (prefill.autonomy === 'scheduled' ? 'scheduled' : 'multi_step') : 'none',
    toolRequirements: agent ? (prefill.toolRequirements?.length ? prefill.toolRequirements : ['web']) : (prefill.toolRequirements ?? []),
    answeredFields,
  };
}

function showResult() {
  const profile = collectProfile();
  const target = $('step-result');
  if (activeTool === 'agent') {
    target.innerHTML = renderClassification(classifyInteraction(profile));
  } else if (activeTool === 'downgrade') {
    const currentId = ($('q-current-model') as HTMLSelectElement).value;
    const current = MODEL_REGISTRY.find((m) => m.id === currentId) ?? MODEL_REGISTRY[0]!;
    target.innerHTML = renderDowngrade(downgrade(profile, current, MODEL_REGISTRY));
  } else {
    target.innerHTML = renderOutcome(route(profile, MODEL_REGISTRY));
  }
  target.classList.remove('hidden');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  attachAgain();
}

function attachAgain() {
  const again = document.getElementById('btn-again');
  if (again) {
    again.addEventListener('click', () => {
      $('step-result').classList.add('hidden');
      $('step-questions').classList.add('hidden');
      $('step-cost').classList.add('hidden');
      if (activeTool !== 'inspect') {
        ($('description') as HTMLTextAreaElement).focus();
      } else {
        ($('q-file') as HTMLInputElement).value = '';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

async function showInspectResult(file: File) {
  const facts = await extractFileFacts(file);
  const target = $('step-result');
  target.innerHTML = renderInspection(assessFile(facts, MODEL_REGISTRY));
  target.classList.remove('hidden');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  attachAgain();
}

function showCostResult() {
  const usage: UsageProfile = {
    currentModelId: ($('qc-model') as HTMLSelectElement).value,
    taskCategory: ($('qc-category') as HTMLSelectElement).value as UsageProfile['taskCategory'],
    taskComplexity: ($('qc-complexity') as HTMLSelectElement).value as UsageProfile['taskComplexity'],
    inputSize: ($('qc-input') as HTMLSelectElement).value as UsageProfile['inputSize'],
    outputSize: ($('qc-output') as HTMLSelectElement).value as UsageProfile['outputSize'],
    systemPromptSize: ($('qc-sysprompt') as HTMLSelectElement).value as UsageProfile['systemPromptSize'],
    repeatedContext: ($('qc-repeated') as HTMLInputElement).checked,
    cachingEnabled: ($('qc-caching') as HTMLSelectElement).value as UsageProfile['cachingEnabled'],
    sessions: ($('qc-sessions') as HTMLSelectElement).value as UsageProfile['sessions'],
    agents: ($('qc-agents') as HTMLSelectElement).value as UsageProfile['agents'],
    toolCalls: ($('qc-toolcalls') as HTMLSelectElement).value as UsageProfile['toolCalls'],
    rag: ($('qc-rag') as HTMLSelectElement).value as UsageProfile['rag'],
  };
  const target = $('step-result');
  target.innerHTML = renderCostDiagnosis(diagnoseCost(usage, MODEL_REGISTRY));
  target.classList.remove('hidden');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  attachAgain();
}

function dataFreshnessNote(): string {
  const dates = MODEL_REGISTRY.flatMap((m) => [m.inputCost.verified, m.contextLimit.verified]).filter(
    (d) => /^\d{4}-\d{2}-\d{2}$/.test(d),
  );
  const newest = dates.sort().at(-1) ?? 'unknown';
  const oldest = dates.sort().at(0) ?? 'unknown';
  return `Model pricing and limits last verified between ${oldest} and ${newest}. Sources and freshness for every fact are tracked per model; stale data lowers the confidence shown with each recommendation. Everything on this page runs locally in your browser — your task description is never sent anywhere.`;
}

$('btn-start').addEventListener('click', startQuestions);
$('btn-route').addEventListener('click', showResult);
$('tab-router').addEventListener('click', () => selectTool('router'));
$('tab-agent').addEventListener('click', () => selectTool('agent'));
$('tab-downgrade').addEventListener('click', () => selectTool('downgrade'));
$('tab-cost').addEventListener('click', () => selectTool('cost'));
$('tab-inspect').addEventListener('click', () => selectTool('inspect'));
$('btn-diagnose').addEventListener('click', showCostResult);
($('q-file') as HTMLInputElement).addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void showInspectResult(file);
});
populateCurrentModels();
($('description') as HTMLTextAreaElement).addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') startQuestions();
});
$('data-note').textContent = dataFreshnessNote();
