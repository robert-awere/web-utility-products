/**
 * Hand and Foot scorekeeper UI.
 * All totals come from the engine. This file must not multiply pile
 * bonuses, card values, or red-three scores.
 */
import {
  CARD_FIELDS,
  DEFAULT_TARGET_ROUNDS,
  DEFAULT_VARIANT_ID,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MIN_ROUNDS,
  RULES_SOURCE,
  canClaimGoingOut,
  clampInt,
  emptyRoundInput,
  formatResultsText,
  getVariant,
  initialMeldRequirement,
  listVariants,
  makePlayerId,
  recomputeGame,
  scoreRound,
} from "../engine/hand-and-foot.js";
import {
  clearGame,
  loadPlayerNames,
  loadTargetRounds,
  loadVariantId,
  resumeCandidate,
  saveGame,
  savePlayerNames,
  saveTargetRounds,
  saveVariantId,
} from "../engine/storage.js";

const DEFAULT_NAMES = ["Player 1", "Player 2"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultDraft(players) {
  const playersMap = {};
  for (const p of players) playersMap[p.id] = emptyRoundInput();
  return { players: playersMap };
}

function buildPlayers(names) {
  return names.map((name, i) => ({
    id: makePlayerId(i),
    name: String(name || `Player ${i + 1}`).trim() || `Player ${i + 1}`,
  }));
}

function createState(names, variantId, targetRounds) {
  const players = buildPlayers(names);
  return {
    version: 1,
    active: true,
    variantId,
    targetRounds,
    players,
    rounds: [],
    draft: defaultDraft(players),
    editing: null,
  };
}

export function mountScorekeeper(root) {
  if (!root) return;

  let names = loadPlayerNames(DEFAULT_NAMES).slice(0, MAX_PLAYERS);
  if (names.length < MIN_PLAYERS) names = DEFAULT_NAMES.slice();
  let variantId = loadVariantId(DEFAULT_VARIANT_ID);
  if (!getVariant(variantId) || getVariant(variantId).id !== variantId) {
    variantId = DEFAULT_VARIANT_ID;
  }
  let targetRounds = clampInt(
    loadTargetRounds(DEFAULT_TARGET_ROUNDS),
    MIN_ROUNDS,
    MAX_ROUNDS,
    DEFAULT_TARGET_ROUNDS
  );

  let state = null;
  let resume = resumeCandidate();
  let copyStatus = "";
  let wakeLock = null;
  let wakeLockSupported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  function persistMeta() {
    savePlayerNames(names);
    saveVariantId(variantId);
    saveTargetRounds(targetRounds);
  }

  function persistGame() {
    if (state && state.active) saveGame(state);
  }

  function variant() {
    return getVariant(state ? state.variantId : variantId);
  }

  function computed() {
    if (!state) return null;
    return recomputeGame(state);
  }

  function currentRoundNumber() {
    if (!state) return 1;
    if (state.editing) return state.editing.roundIndex + 1;
    return state.rounds.length + 1;
  }

  function workingInputs() {
    if (!state) return {};
    if (state.editing) return state.editing.players;
    return state.draft.players;
  }

  function setWorkingInput(playerId, next, opts = {}) {
    if (state.editing) {
      state.editing.players[playerId] = next;
    } else {
      state.draft.players[playerId] = next;
    }
    persistGame();
    if (!opts.silent) render();
  }

  function patchInput(playerId, patch, opts = {}) {
    const cur = workingInputs()[playerId] || emptyRoundInput();
    setWorkingInput(playerId, { ...clone(cur), ...patch }, opts);
  }

  function patchCount(playerId, bag, key, value, opts = {}) {
    const cur = workingInputs()[playerId] || emptyRoundInput();
    const nextBag = { ...emptyRoundInput()[bag], ...(cur[bag] || {}), [key]: Math.max(0, value) };
    setWorkingInput(playerId, { ...clone(cur), useCardCounts: true, [bag]: nextBag }, opts);
  }

  async function requestWakeLock() {
    if (!wakeLockSupported) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function onVisibility() {
    if (document.visibilityState === "visible" && state && state.active && !computed().complete) {
      requestWakeLock();
    }
  }

  document.addEventListener("visibilitychange", onVisibility);

  function startNewGame() {
    persistMeta();
    state = createState(names, variantId, targetRounds);
    resume = null;
    copyStatus = "";
    persistGame();
    requestWakeLock();
    render();
  }

  function discardResume() {
    clearGame();
    resume = null;
    state = null;
    releaseWakeLock();
    render();
  }

  function acceptResume() {
    state = resume;
    if (!state.draft || !state.draft.players) state.draft = defaultDraft(state.players);
    if (!Array.isArray(state.rounds)) state.rounds = [];
    resume = null;
    persistGame();
    requestWakeLock();
    render();
  }

  function confirmNewGame() {
    if (!state) {
      startNewGame();
      return;
    }
    const ok = window.confirm("Start a new game? The current scores will be cleared from this browser.");
    if (!ok) return;
    clearGame();
    startNewGame();
  }

  function recordRound() {
    if (!state || computed().complete) return;
    const inputs = workingInputs();
    const wentOutIds = state.players.filter((p) => inputs[p.id] && inputs[p.id].wentOut).map((p) => p.id);
    if (wentOutIds.length > 1) {
      window.alert("Only one side can go out on a deal. Uncheck the extra Going out boxes.");
      return;
    }
    if (state.editing) {
      const idx = state.editing.roundIndex;
      state.rounds[idx] = { players: clone(state.editing.players) };
      state.editing = null;
    } else {
      state.rounds.push({ players: clone(state.draft.players) });
      state.draft = defaultDraft(state.players);
    }
    persistGame();
    const g = computed();
    if (g.complete) releaseWakeLock();
    render();
    const summary = root.querySelector("[data-end-summary]");
    if (g.complete && summary) summary.focus();
  }

  function undoLast() {
    if (!state) return;
    if (state.editing) {
      state.editing = null;
      persistGame();
      render();
      return;
    }
    if (state.rounds.length === 0) return;
    const last = state.rounds.pop();
    state.draft = { players: clone(last.players) };
    persistGame();
    requestWakeLock();
    render();
  }

  function beginEdit(roundIndex) {
    if (!state || !state.rounds[roundIndex]) return;
    state.editing = {
      roundIndex,
      players: clone(state.rounds[roundIndex].players),
    };
    persistGame();
    render();
    root.querySelector("#round-entry")?.focus();
  }

  async function copyResults() {
    const g = computed();
    if (!g) return;
    const text = formatResultsText(state, g);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      copyStatus = "Results copied to the clipboard.";
    } catch {
      copyStatus = "Copy failed. Select the summary text and copy it yourself.";
    }
    render();
  }

  function stepper(id, label, value, onChange, opts = {}) {
    const min = opts.min ?? 0;
    const max = opts.max ?? 99;
    const hint = opts.hint ? `<span class="stepper-hint">${esc(opts.hint)}</span>` : "";
    return `
      <div class="stepper">
        <label class="stepper-label" for="${id}">${esc(label)}${hint}</label>
        <div class="stepper-controls">
          <button type="button" class="stepper-btn" data-act="dec" data-for="${id}" aria-label="Decrease ${esc(label)}">−</button>
          <input id="${id}" class="stepper-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${value}" data-min="${min}" data-max="${max}" aria-label="${esc(label)}" />
          <button type="button" class="stepper-btn" data-act="inc" data-for="${id}" aria-label="Increase ${esc(label)}">+</button>
        </div>
      </div>`;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSetup() {
    const variants = listVariants();
    const resumeBanner = resume
      ? `<div class="resume" role="region" aria-label="Resume saved game">
          <p><strong>Resume game?</strong> A Hand and Foot game was saved in this browser within the last 24 hours.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" data-act="resume">Resume game</button>
            <button type="button" class="btn btn-ghost" data-act="discard-resume">Discard it</button>
          </div>
        </div>`
      : "";

    const nameFields = names
      .map(
        (n, i) => `
        <div class="name-row">
          <label for="name-${i}">Player ${i + 1}</label>
          <input id="name-${i}" class="name-input" type="text" maxlength="40" value="${esc(n)}" autocomplete="nickname" data-name-index="${i}" />
          ${
            names.length > MIN_PLAYERS
              ? `<button type="button" class="btn btn-icon" data-act="remove-name" data-index="${i}" aria-label="Remove player ${i + 1}">Remove</button>`
              : ""
          }
        </div>`
      )
      .join("");

    root.innerHTML = `
      ${resumeBanner}
      <form class="setup" id="setup-form">
        <fieldset>
          <legend>Who is playing</legend>
          <p class="lede">Two to eight names. For partnership Hand and Foot, enter one name per side (for example “Ada &amp; Ben”). Names stay in this browser.</p>
          <div class="name-list">${nameFields}</div>
          ${
            names.length < MAX_PLAYERS
              ? `<button type="button" class="btn btn-ghost" data-act="add-name">Add a player</button>`
              : ""
          }
        </fieldset>
        <fieldset>
          <legend>Rules variant</legend>
          <p class="lede">Named from <a href="${esc(RULES_SOURCE.url)}">Pagat — Hand and Foot</a> (retrieved ${esc(RULES_SOURCE.retrieved)}). Default is the most usual version on that page.</p>
          <div class="variant-list">
            ${variants
              .map((v) => {
                const checked = v.id === variantId ? "checked" : "";
                return `<label class="variant-card">
                  <input type="radio" name="variant" value="${v.id}" ${checked} />
                  <span>
                    <strong>${esc(v.name)}</strong>${v.default ? ' <span class="pill">Default</span>' : ""}
                    <span class="variant-note">${esc(v.goingOutNote)}</span>
                    <span class="variant-note">${esc(v.redThreeNote)}</span>
                  </span>
                </label>`;
              })
              .join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>Length</legend>
          <p class="lede">Pagat / Whitnack: a complete game is four deals. You can shorten or lengthen it.</p>
          ${stepper("target-rounds", "Deals in this game", targetRounds, null, { min: MIN_ROUNDS, max: MAX_ROUNDS })}
        </fieldset>
        <div class="btn-row">
          <button type="submit" class="btn btn-primary">Start game</button>
        </div>
      </form>`;
  }

  function playerEntryCard(player, inp, v, g) {
    const breakdown = scoreRound(inp, v);
    const prior = g.perPlayer.find((p) => p.id === player.id);
    const running = prior ? prior.total : 0;
    const go = canClaimGoingOut(inp, v);
    const warn =
      inp.wentOut && !go.ok
        ? `<p class="warn" role="status">Going-out claim does not meet ${esc(v.shortName)} pile requirement: ${esc(go.missing.join("; "))}.</p>`
        : "";

    const pileSteppers = [
      stepper(`${player.id}-clean`, "Natural (clean) piles", inp.cleanPiles, null, {
        hint: "seven natural cards",
      }),
      stepper(`${player.id}-dirty`, "Mixed (dirty) piles", inp.dirtyPiles, null, {
        hint: "seven with wilds",
      }),
    ];
    if (v.usesWildPiles) {
      pileSteppers.push(
        stepper(`${player.id}-wild`, "Wild piles", inp.wildPiles, null, {
          hint: "seven wild cards",
        })
      );
    }

    const cardGrid = (bag, title) => `
      <details class="card-counts" open>
        <summary>${esc(title)}</summary>
        <div class="stepper-grid">
          ${CARD_FIELDS.map((f) =>
            stepper(
              `${player.id}-${bag}-${f.key}`,
              f.label,
              (inp[bag] && inp[bag][f.key]) || 0,
              null,
              { hint: f.hint }
            )
          ).join("")}
        </div>
      </details>`;

    return `
      <section class="player-card" aria-labelledby="ph-${player.id}">
        <header class="player-head">
          <h3 id="ph-${player.id}">${esc(player.name)}</h3>
          <p class="running">Running total <strong>${running}</strong></p>
        </header>
        <div class="stepper-grid">${pileSteppers.join("")}</div>
        <div class="stepper-grid">
          ${stepper(`${player.id}-r3t`, "Red threes on the table", inp.redThreesTabled, null, {
            hint: v.id === "simpson" ? "−500 each in Simpson" : "+100 each in Whitnack",
          })}
          ${stepper(`${player.id}-r3u`, "Red threes still in hand or foot", inp.redThreesUntabled, null, {
            hint: v.id === "simpson" ? "−500 each in Simpson" : "−100 each in Whitnack",
          })}
        </div>
        ${cardGrid("melded", "Melded cards (count for you)")}
        ${cardGrid("leftover", "Cards left in hand or foot (count against you)")}
        <label class="check-row">
          <input type="checkbox" data-wentout="${player.id}" ${inp.wentOut ? "checked" : ""} />
          <span>Went out this deal</span>
        </label>
        ${warn}
        <p class="round-total" aria-live="polite">This deal: <strong>${breakdown.total}</strong>
          <span class="breakdown-bits">
            piles ${breakdown.pileBonus},
            red 3s ${breakdown.redThreeScore},
            cards ${breakdown.netCards}${breakdown.wentOut ? `, out ${breakdown.outBonus}` : ""}
          </span>
        </p>
      </section>`;
  }

  function renderGame() {
    const v = variant();
    const g = computed();
    const roundNo = currentRoundNumber();
    const editing = Boolean(state.editing);
    const complete = g.complete && !editing;
    const meldMin = initialMeldRequirement(roundNo, v);
    const leaderNames = g.perPlayer.filter((p) => g.leaders.includes(p.id)).map((p) => p.name);
    const leaderText =
      g.roundsPlayed === 0 && !editing
        ? "No deals recorded yet"
        : leaderNames.length === 1
          ? `Leader: ${leaderNames[0]}`
          : `Leaders: ${leaderNames.join(", ")}`;

    const history =
      g.roundsPlayed === 0
        ? `<p class="muted">No deals recorded yet. Fill the piles and cards, then record the deal.</p>`
        : `<div class="table-wrap" tabindex="0">
            <table class="history">
              <caption>Deal history — tap a deal number to edit it</caption>
              <thead>
                <tr>
                  <th scope="col">Deal</th>
                  ${g.perPlayer.map((p) => `<th scope="col">${esc(p.name)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${state.rounds
                  .map((_, i) => {
                    const cells = g.perPlayer
                      .map((p) => `<td>${p.breakdowns[i].total}</td>`)
                      .join("");
                    return `<tr>
                      <th scope="row"><button type="button" class="linkish" data-act="edit-round" data-round="${i}">Deal ${i + 1}</button></th>
                      ${cells}
                    </tr>`;
                  })
                  .join("")}
                <tr class="totals-row">
                  <th scope="row">Total</th>
                  ${g.perPlayer
                    .map((p) => {
                      const isLead = g.leaders.includes(p.id) && g.roundsPlayed > 0;
                      return `<td>${p.total}${isLead ? ' <span class="pill">Leader</span>' : ""}</td>`;
                    })
                    .join("")}
                </tr>
              </tbody>
            </table>
          </div>`;

    const end =
      complete
        ? `<section class="end-summary" data-end-summary tabindex="-1" aria-labelledby="end-h">
            <h3 id="end-h">Game over — ${g.targetRounds} deals</h3>
            <p>${
              leaderNames.length === 1
                ? `<strong>${esc(leaderNames[0])}</strong> has the high total.`
                : `Tie: <strong>${esc(leaderNames.join(", "))}</strong>.`
            }</p>
            <ol class="final-list">
              ${g.perPlayer
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((p) => `<li>${esc(p.name)} — ${p.total}</li>`)
                .join("")}
            </ol>
            <div class="btn-row">
              <button type="button" class="btn btn-primary" data-act="copy">Copy results</button>
              <button type="button" class="btn btn-ghost" data-act="new-game">New game</button>
            </div>
            ${copyStatus ? `<p class="status" role="status">${esc(copyStatus)}</p>` : ""}
            <pre class="results-pre">${esc(formatResultsText(state, g))}</pre>
          </section>`
        : "";

    const inputs = workingInputs();
    const entry = complete
      ? ""
      : `<div id="round-entry" class="round-entry" tabindex="-1">
          <h3>${editing ? `Edit deal ${roundNo}` : `Deal ${roundNo} of ${g.targetRounds}`}</h3>
          <p class="lede">First meld minimum this deal (card points only, not pile bonuses or red threes): <strong>${meldMin}</strong>. Source: Pagat / Whitnack.</p>
          ${state.players.map((p) => playerEntryCard(p, inputs[p.id] || emptyRoundInput(), v, g)).join("")}
          <div class="btn-row sticky-actions">
            <button type="button" class="btn btn-primary" data-act="record">${editing ? "Save changes" : "Record deal"}</button>
            <button type="button" class="btn btn-ghost" data-act="undo">${editing ? "Cancel edit" : "Undo last deal"}</button>
          </div>
        </div>`;

    root.innerHTML = `
      <div class="game-bar" role="status">
        <p><strong>${esc(v.name)}</strong> · ${esc(leaderText)}</p>
        <p class="muted">Wake lock ${wakeLock ? "on" : wakeLockSupported ? "off" : "not available on this browser"}</p>
      </div>
      ${end}
      ${entry}
      <section class="history-block" aria-labelledby="hist-h">
        <h3 id="hist-h">Running totals</h3>
        ${history}
      </section>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" data-act="new-game">New game</button>
      </div>`;
  }

  function refreshLiveTotals() {
    if (!state) return;
    const v = variant();
    const g = computed();
    for (const p of state.players) {
      const inp = workingInputs()[p.id] || emptyRoundInput();
      const breakdown = scoreRound(inp, v);
      const prior = g.perPlayer.find((row) => row.id === p.id);
      const running = prior ? prior.total : 0;
      const totalEl = root.querySelector(`#ph-${p.id}`)?.closest(".player-card")?.querySelector(".round-total");
      if (totalEl) {
        totalEl.innerHTML = `This deal: <strong>${breakdown.total}</strong>
          <span class="breakdown-bits">
            piles ${breakdown.pileBonus},
            red 3s ${breakdown.redThreeScore},
            cards ${breakdown.netCards}${breakdown.wentOut ? `, out ${breakdown.outBonus}` : ""}
          </span>`;
      }
      const runEl = root.querySelector(`#ph-${p.id}`)?.closest(".player-card")?.querySelector(".running");
      if (runEl) runEl.innerHTML = `Running total <strong>${running}</strong>`;
    }
  }

  function render() {
    if (!state) renderSetup();
    else renderGame();
    bind();
  }

  function readStepperValue(inputEl) {
    const min = Number(inputEl.dataset.min || 0);
    const max = Number(inputEl.dataset.max || 99);
    const n = parseInt(String(inputEl.value).replace(/[^\d-]/g, ""), 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function applyStepper(id, nextValue, opts = {}) {
    if (id === "target-rounds") {
      targetRounds = clampInt(nextValue, MIN_ROUNDS, MAX_ROUNDS, DEFAULT_TARGET_ROUNDS);
      persistMeta();
      const el = root.querySelector("#target-rounds");
      if (el) el.value = String(targetRounds);
      return;
    }
    if (!state) return;
    const [playerId, field, extra] = splitControl(id);
    const cur = workingInputs()[playerId] || emptyRoundInput();
    if (field === "clean") patchInput(playerId, { cleanPiles: nextValue }, opts);
    else if (field === "dirty") patchInput(playerId, { dirtyPiles: nextValue }, opts);
    else if (field === "wild") patchInput(playerId, { wildPiles: nextValue }, opts);
    else if (field === "r3t") patchInput(playerId, { redThreesTabled: nextValue }, opts);
    else if (field === "r3u") patchInput(playerId, { redThreesUntabled: nextValue }, opts);
    else if (field === "melded" || field === "leftover") patchCount(playerId, field, extra, nextValue, opts);
    else {
      void cur;
    }
  }

  function splitControl(id) {
    // p1-clean | p1-r3t | p1-melded-jokers
    const parts = id.split("-");
    const playerId = parts[0];
    const field = parts[1];
    const extra = parts.slice(2).join("-");
    return [playerId, field, extra];
  }

  function bind() {
    root.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const act = e.currentTarget.getAttribute("data-act");
        if (act === "add-name") {
          if (names.length < MAX_PLAYERS) {
            names = names.concat([`Player ${names.length + 1}`]);
            persistMeta();
            render();
          }
        } else if (act === "remove-name") {
          const i = Number(e.currentTarget.getAttribute("data-index"));
          if (names.length > MIN_PLAYERS) {
            names = names.filter((_, idx) => idx !== i);
            persistMeta();
            render();
          }
        } else if (act === "resume") acceptResume();
        else if (act === "discard-resume") discardResume();
        else if (act === "record") recordRound();
        else if (act === "undo") undoLast();
        else if (act === "new-game") confirmNewGame();
        else if (act === "copy") copyResults();
        else if (act === "edit-round") beginEdit(Number(e.currentTarget.getAttribute("data-round")));
        else if (act === "dec" || act === "inc") {
          const id = e.currentTarget.getAttribute("data-for");
          const inputEl = root.querySelector(`#${cssEscape(id)}`);
          if (!inputEl) return;
          const delta = act === "inc" ? 1 : -1;
          const next = readStepperValue(inputEl) + delta;
          applyStepper(id, next);
        }
      });
    });

    root.querySelectorAll(".stepper-input").forEach((inputEl) => {
      inputEl.addEventListener("change", () => {
        applyStepper(inputEl.id, readStepperValue(inputEl));
      });
      inputEl.addEventListener("input", () => {
        if (!state && inputEl.id === "target-rounds") {
          targetRounds = clampInt(readStepperValue(inputEl), MIN_ROUNDS, MAX_ROUNDS, DEFAULT_TARGET_ROUNDS);
          persistMeta();
          return;
        }
        if (!state) return;
        applyStepper(inputEl.id, readStepperValue(inputEl), { silent: true });
        refreshLiveTotals();
      });
    });

    root.querySelectorAll("[data-name-index]").forEach((inputEl) => {
      inputEl.addEventListener("input", () => {
        const i = Number(inputEl.getAttribute("data-name-index"));
        names[i] = inputEl.value;
        persistMeta();
      });
    });

    root.querySelectorAll('input[name="variant"]').forEach((el) => {
      el.addEventListener("change", () => {
        variantId = el.value;
        persistMeta();
      });
    });

    const form = root.querySelector("#setup-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const collected = [];
        root.querySelectorAll("[data-name-index]").forEach((el) => collected.push(el.value));
        names = collected.map((n, i) => String(n).trim() || `Player ${i + 1}`);
        const chosen = root.querySelector('input[name="variant"]:checked');
        if (chosen) variantId = chosen.value;
        const tr = root.querySelector("#target-rounds");
        if (tr) targetRounds = clampInt(readStepperValue(tr), MIN_ROUNDS, MAX_ROUNDS, DEFAULT_TARGET_ROUNDS);
        persistMeta();
        startNewGame();
      });
    }

    root.querySelectorAll("[data-wentout]").forEach((el) => {
      el.addEventListener("change", () => {
        const id = el.getAttribute("data-wentout");
        if (el.checked) {
          for (const p of state.players) {
            const cur = workingInputs()[p.id] || emptyRoundInput();
            if (p.id === id) continue;
            if (cur.wentOut) {
              workingInputs()[p.id] = { ...clone(cur), wentOut: false };
            }
          }
        }
        patchInput(id, { wentOut: el.checked });
      });
    });
  }

  function cssEscape(id) {
    if (window.CSS && CSS.escape) return CSS.escape(id);
    return id.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  render();
}
