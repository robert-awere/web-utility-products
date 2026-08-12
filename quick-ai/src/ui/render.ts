/** Result rendering — compact, explained, progressive disclosure. */

import type { ModelEvaluation, Reason, RouterOutcome } from '../domain/result';

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
      </div>`;
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
