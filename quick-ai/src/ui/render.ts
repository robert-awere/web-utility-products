/** Result rendering — compact, explained, progressive disclosure. */

import type { ModelEvaluation, Reason, RouterOutcome } from '../domain/result';
import type { CostDiagnosis } from '../engine/costleak';
import type { DocumentAssessment } from '../engine/inspect';
import type { DowngradeOutcome } from '../engine/downgrader';
import type { InteractionClassification } from '../engine/interaction';
import { isAgentMode } from '../engine/interaction';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function reasonLi(r: Reason): string {
  const cls = r.sign === '+' ? 'plus' : r.sign === '-' ? 'minus' : 'flag';
  return `<li class="${cls}">${esc(r.text)}</li>`;
}

function costLabel(e: ModelEvaluation): string {
  const i = e.model.inputCost.value;
  const o = e.model.outputCost.value;
  if (i == null || o == null) return e.model.deployment === 'local' ? 'self-hosted (no per-token cost)' : 'pricing unverified';
  return `$${i} in / $${o} out per 1M tokens`;
}

function confidencePill(level: string): string {
  return `<span class="pill conf-${esc(level)}">Confidence: ${esc(level)}</span>`;
}

export function renderClassification(c: InteractionClassification): string {
  const agent = isAgentMode(c.mode);
  return `
    <div class="result-card ${agent ? '' : 'noai-card'}">
      <p class="kicker">Agent or chat?</p>
      <h2 class="mode-headline">${esc(c.headline)}</h2>
      <p><span class="pill fit">${agent ? 'AGENT' : c.mode === 'traditional_software' || c.mode === 'no_ai_needed' ? 'NO AI' : c.mode === 'workflow_automation' ? 'AUTOMATION' : 'CHAT'}</span></p>
      <h3 class="section">Why</h3>
      <ul class="reasons">${c.why.map(reasonLi).join('')}</ul>
      ${c.agentGuard ? `<p class="guard-note">${esc(c.agentGuard)}</p>` : ''}
    </div>
    <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
}

const DOWNGRADE_HEADLINES: Record<DowngradeOutcome['verdict'], (d: DowngradeOutcome) => string> = {
  use_deterministic_code: () => 'Drop the model — use code.',
  downgrade: (d) => `Yes — switch to ${d.recommended?.model.model ?? 'a cheaper model'}.`,
  split_workflow: (d) => `Split the workflow — ${d.recommended?.model.model ?? 'a cheaper model'} for routine items, escalate the rest.`,
  upgrade: (d) => `No — your current model is too weak for this task${d.recommended ? `; use ${d.recommended.model.model}` : ''}.`,
  keep: () => 'Keep your current model.',
};

export function renderDowngrade(d: DowngradeOutcome): string {
  return `
    <div class="result-card">
      <p class="kicker">Model downgrader</p>
      <h2 class="mode-headline">${esc(DOWNGRADE_HEADLINES[d.verdict](d))}</h2>
      <p>
        ${d.savingsPct != null ? `<span class="pill fit">~${d.savingsPct}% cheaper per token</span>` : ''}
        ${confidencePill(d.confidence.level)}
      </p>
      <h3 class="section">Why</h3>
      <ul class="reasons">${d.reasons.map(reasonLi).join('')}</ul>
      ${d.recommended ? `
      <h3 class="section">Recommended</h3>
      <div class="alt">
        <span class="alt-name">${esc(d.recommended.model.model)}</span>
        <span class="alt-fit"> — Fit: ${esc(d.recommended.fit)} · ${esc(costLabel(d.recommended))}</span>
      </div>` : ''}
      ${d.current ? `
      <details>
        <summary>How your current model scored on this task</summary>
        <div class="alt">
          <span class="alt-name">${esc(d.current.model.model)}</span>
          <span class="alt-fit"> — Fit: ${esc(d.current.fit)} · ${esc(costLabel(d.current))}</span>
          <ul class="reasons">${d.current.reasons.map(reasonLi).join('')}</ul>
        </div>
      </details>` : ''}
      <details>
        <summary>Why this confidence level</summary>
        <ul class="reasons">${d.confidence.factors.map((f) => `<li class="flag">${esc(f)}</li>`).join('')}</ul>
      </details>
    </div>
    <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
}

const SEVERITY_CLASS: Record<string, string> = { HIGH: 'conf-LOW', MEDIUM: 'conf-MEDIUM', LOW: 'conf-HIGH' };

export function renderCostDiagnosis(d: CostDiagnosis): string {
  if (d.allClear) {
    return `
      <div class="result-card noai-card">
        <p class="kicker">Cost leak</p>
        <h2 class="mode-headline">No major leak found.</h2>
        <p>${esc(d.allClear)}</p>
      </div>
      <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
  }
  return `
    <div class="result-card">
      <p class="kicker">Cost leak</p>
      <h2 class="mode-headline">${d.findings.length === 1 ? '1 likely cost source' : `${d.findings.length} likely cost sources`}, ranked.</h2>
      ${d.findings.map((f) => `
        <div class="alt">
          <span class="pill ${SEVERITY_CLASS[f.severity] ?? ''}">${esc(f.severity)}</span>
          <span class="alt-name">${esc(f.title)}</span>
          <ul class="reasons">
            <li class="flag">${esc(f.evidence)}</li>
            <li class="plus">${esc(f.action)}</li>
          </ul>
        </div>`).join('')}
      ${d.cheaperArchitecture ? `
      <h3 class="section">Cheaper architecture</h3>
      <ol class="workflow">${d.cheaperArchitecture.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    </div>
    <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
}

export function renderInspection(a: DocumentAssessment): string {
  return `
    <div class="result-card ${a.verdict === 'direct' ? 'noai-card' : ''}">
      <p class="kicker">Can AI handle this? · <span style="color:var(--good)">processed locally — file not uploaded</span></p>
      <h2 class="mode-headline">${esc(a.headline)}</h2>
      <h3 class="section">What we found</h3>
      <ul class="reasons">${a.facts.map(reasonLi).join('')}</ul>
      ${a.failureModes.length ? `
      <h3 class="section">Likely failure modes</h3>
      <ul class="reasons">${a.failureModes.map((f) => `<li class="minus">${esc(f)}</li>`).join('')}</ul>` : ''}
      ${a.preprocessing.length ? `
      <h3 class="section">Preprocessing needed</h3>
      <ol class="workflow">${a.preprocessing.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <h3 class="section">Recommended model class</h3>
      <p>${esc(a.recommendedClass)}</p>
      ${a.fittingModels.length ? `
      <details>
        <summary>Registry models whose verified context fits (${a.fittingModels.length})</summary>
        <ul class="reasons">${a.fittingModels.map((m) => `<li class="plus">${esc(m)}</li>`).join('')}</ul>
      </details>` : ''}
      <h3 class="section">Safest workflow</h3>
      <ol class="workflow">${a.workflow.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </div>
    <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
}

export function renderOutcome(outcome: RouterOutcome): string {
  if (outcome.kind === 'no_ai') {
    return `
      <div class="result-card noai-card">
        <p class="kicker">Recommendation</p>
        <h2 class="winner-name">Don't use AI for this.</h2>
        <p class="winner-meta">${confidencePill(outcome.confidence.level)}</p>
        <h3 class="section">Why</h3>
        <p>${esc(outcome.reason)}</p>
        <h3 class="section">Do this instead</h3>
        <p>${esc(outcome.suggestion)}</p>
        <details>
          <summary>Why this confidence level</summary>
          <ul class="reasons">${outcome.confidence.factors.map((f) => `<li class="flag">${esc(f)}</li>`).join('')}</ul>
        </details>
      </div>
      <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
  }

  const w = outcome.winner;
  const alt = outcome.alternatives;
  const cheaper = outcome.cheaperOption;

  return `
    <div class="result-card">
      <p class="kicker">Best fit</p>
      <h2 class="winner-name">${esc(w.model.model)}</h2>
      <p class="winner-meta">${esc(w.model.provider)} · ${esc(costLabel(w))}</p>
      <p>
        <span class="pill fit">Fit: ${esc(w.fit === 'BEST_FIT' ? 'BEST' : w.fit)}</span>
        ${confidencePill(outcome.confidence.level)}
      </p>

      <h3 class="section">Why it won</h3>
      <ul class="reasons">${outcome.whyWon.map(reasonLi).join('') || '<li class="plus">best overall balance of capability and cost for this task</li>'}</ul>

      ${outcome.watchOut.length ? `<h3 class="section">Watch out</h3><ul class="reasons">${outcome.watchOut.map(reasonLi).join('')}</ul>` : ''}

      ${cheaper ? `
      <h3 class="section">Cheaper option</h3>
      <div class="alt">
        <span class="alt-name">${esc(cheaper.model.model)}</span>
        <span class="alt-fit"> — Fit: ${esc(cheaper.fit)} · ${esc(costLabel(cheaper))}</span>
      </div>` : ''}

      <h3 class="section">Recommended workflow</h3>
      <ol class="workflow">${outcome.workflow.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

      ${alt.length ? `
      <details>
        <summary>Why the others lost (${alt.length})</summary>
        ${alt.map((a) => `
          <div class="alt">
            <span class="alt-name">${esc(a.evaluation.model.model)}</span>
            <span class="alt-fit"> — Fit: ${esc(a.evaluation.fit)} · ${esc(costLabel(a.evaluation))}</span>
            <ul class="reasons">${a.whyLost.map(reasonLi).join('')}</ul>
          </div>`).join('')}
      </details>` : ''}

      ${outcome.whatCouldChange.length ? `
      <details>
        <summary>What could change this result</summary>
        <ul class="reasons">${outcome.whatCouldChange.map((s) => `<li class="flag">${esc(s)}</li>`).join('')}</ul>
      </details>` : ''}

      <details>
        <summary>Why this confidence level</summary>
        <ul class="reasons">${outcome.confidence.factors.map((f) => `<li class="flag">${esc(f)}</li>`).join('')}</ul>
      </details>

      <details>
        <summary>Full comparison (${outcome.allEvaluations.length} options)</summary>
        <table class="evals">
          <thead><tr><th>Model</th><th>Fit</th><th>Cost / 1M</th></tr></thead>
          <tbody>
            ${outcome.allEvaluations.map((e) => `
              <tr>
                <td>${esc(e.model.model)}</td>
                <td>${esc(e.fit)}</td>
                <td>${e.model.inputCost.value != null ? `$${e.model.inputCost.value} / $${e.model.outputCost.value}` : esc(e.model.deployment === 'local' ? 'self-hosted' : 'unverified')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </details>
    </div>
    <p class="hint"><button class="link" id="btn-again">Start over</button></p>`;
}
