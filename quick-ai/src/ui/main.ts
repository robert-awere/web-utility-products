/** UI wiring — describe -> confirm ≤4 questions -> explained recommendation. */

import { MODEL_REGISTRY } from '../data/registry';
import { defaultTaskProfile, type Modality, type TaskCategory, type TaskProfile } from '../domain/task';
import { classifyInteraction } from '../engine/interaction';
import { prefillFromDescription } from '../engine/prefill';
import { route } from '../engine/router';
import { esc, renderClassification, renderOutcome } from './render';

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
let activeTool: 'router' | 'agent' = 'router';

function selectTool(tool: 'router' | 'agent') {
  activeTool = tool;
  ($('tab-router') as HTMLButtonElement).setAttribute('aria-pressed', String(tool === 'router'));
  ($('tab-agent') as HTMLButtonElement).setAttribute('aria-pressed', String(tool === 'agent'));
  // Constraints (privacy/budget) influence model routing but not the
  // agent-or-chat classification — never ask a question that can't change
  // the recommendation.
  $('fieldset-constraints').classList.toggle('hidden', tool === 'agent');
  $('step-result').classList.add('hidden');
}

function startQuestions() {
  const description = ($('description') as HTMLTextAreaElement).value.trim();
  if (!description) {
    ($('description') as HTMLTextAreaElement).focus();
    return;
  }
  const suggestion = prefillFromDescription(description);
  prefill = { ...suggestion.patch, description };

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
  } else {
    target.innerHTML = renderOutcome(route(profile, MODEL_REGISTRY));
  }
  target.classList.remove('hidden');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const again = document.getElementById('btn-again');
  if (again) {
    again.addEventListener('click', () => {
      $('step-result').classList.add('hidden');
      $('step-questions').classList.add('hidden');
      ($('description') as HTMLTextAreaElement).focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
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
($('description') as HTMLTextAreaElement).addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') startQuestions();
});
$('data-note').textContent = dataFreshnessNote();
