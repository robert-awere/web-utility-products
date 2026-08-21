/**
 * localStorage helpers for TableScore.
 * No scoring math — only persist and restore game state and names.
 *
 * Browser: uses window.localStorage.
 * Tests: call setStorageAdapter(createMemoryStore()) so Node can
 * seed, persist, and reload without a window.
 */

export const STORAGE_KEYS = Object.freeze({
  names: "tablescore.v02.playerNames",
  variant: "tablescore.v02.variantId",
  targetRounds: "tablescore.v02.targetRounds",
  game: "tablescore.v02.game",
});

export const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

let adapter = null;

export function createMemoryStore(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    snapshot() {
      return Object.assign({}, data);
    },
  };
}

export function setStorageAdapter(store) {
  adapter = store || null;
}

export function resetStorageAdapter() {
  adapter = null;
}

function getStore() {
  if (adapter) return adapter;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function canUseStorage() {
  const store = getStore();
  if (!store) return false;
  try {
    const k = "__tablescore_probe";
    store.setItem(k, "1");
    store.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadJson(key, fallback) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = getStore().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  if (!canUseStorage()) return false;
  try {
    getStore().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPlayerNames(fallback) {
  const names = loadJson(STORAGE_KEYS.names, null);
  if (Array.isArray(names) && names.length >= 2) return names;
  return fallback;
}

export function savePlayerNames(names) {
  saveJson(STORAGE_KEYS.names, names);
}

export function loadVariantId(fallback) {
  const id = loadJson(STORAGE_KEYS.variant, null);
  return typeof id === "string" ? id : fallback;
}

export function saveVariantId(id) {
  saveJson(STORAGE_KEYS.variant, id);
}

export function loadTargetRounds(fallback) {
  const n = loadJson(STORAGE_KEYS.targetRounds, null);
  return typeof n === "number" ? n : fallback;
}

export function saveTargetRounds(n) {
  saveJson(STORAGE_KEYS.targetRounds, n);
}

export function saveGame(state) {
  const payload = Object.assign({}, state, { savedAt: Date.now() });
  return saveJson(STORAGE_KEYS.game, payload);
}

export function loadGame() {
  return loadJson(STORAGE_KEYS.game, null);
}

export function clearGame() {
  if (!canUseStorage()) return;
  try {
    getStore().removeItem(STORAGE_KEYS.game);
  } catch {
    /* ignore */
  }
}

export function resumeCandidate(now = Date.now()) {
  const game = loadGame();
  if (!game || !game.savedAt) return null;
  if (now - game.savedAt > RESUME_WINDOW_MS) return null;
  const started = Array.isArray(game.rounds) && game.rounds.length > 0;
  const hasDraft =
    game.draft &&
    game.draft.players &&
    Object.keys(game.draft.players).length > 0;
  if (!started && !hasDraft && !game.active) return null;
  return game;
}
