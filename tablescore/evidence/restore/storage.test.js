/**
 * FR-5 restore: seed a mid-game state, persist, reload storage, assert exact restore.
 * Run: node --test src/engine/storage.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEYS,
  RESUME_WINDOW_MS,
  createMemoryStore,
  setStorageAdapter,
  resetStorageAdapter,
  saveGame,
  loadGame,
  clearGame,
  savePlayerNames,
  loadPlayerNames,
  saveVariantId,
  loadVariantId,
  saveTargetRounds,
  loadTargetRounds,
  resumeCandidate,
} from "./storage.js";
import {
  emptyRoundInput,
  recomputeGame,
  scoreRound,
  VARIANTS,
} from "./hand-and-foot.js";

function input(partial) {
  return { ...emptyRoundInput(), ...partial };
}

function midGameState() {
  return {
    version: 1,
    active: true,
    variantId: "whitnack",
    targetRounds: 4,
    players: [
      { id: "p1", name: "Ada" },
      { id: "p2", name: "Ben" },
    ],
    rounds: [
      {
        players: {
          p1: input({
            cleanPiles: 2,
            dirtyPiles: 1,
            redThreesTabled: 1,
            useCardCounts: true,
            melded: {
              jokers: 1,
              twosAndAces: 2,
              eightThroughKing: 0,
              fourThroughSeven: 0,
              blackThrees: 0,
            },
            leftover: {
              jokers: 0,
              twosAndAces: 0,
              eightThroughKing: 0,
              fourThroughSeven: 3,
              blackThrees: 0,
            },
            wentOut: false,
          }),
          p2: input({
            dirtyPiles: 2,
            redThreesUntabled: 1,
            useCardCounts: true,
            leftover: {
              jokers: 1,
              twosAndAces: 0,
              eightThroughKing: 0,
              fourThroughSeven: 0,
              blackThrees: 2,
            },
          }),
        },
      },
    ],
    draft: {
      players: {
        p1: input({ wildPiles: 1, cleanPiles: 1 }),
        p2: input({ dirtyPiles: 1 }),
      },
    },
    editing: null,
  };
}

test("FR-5 seed, persist, reload restores exact mid-game state", () => {
  const storeA = createMemoryStore();
  setStorageAdapter(storeA);

  const seeded = midGameState();
  const saved = saveGame(seeded);
  assert.equal(saved, true);
  savePlayerNames(["Ada", "Ben"]);
  saveVariantId("whitnack");
  saveTargetRounds(4);

  const dump = storeA.snapshot();
  assert.ok(dump[STORAGE_KEYS.game]);

  // Simulate a new page load: new adapter over the same serialized bytes.
  resetStorageAdapter();
  const storeB = createMemoryStore(dump);
  setStorageAdapter(storeB);

  const restored = loadGame();
  assert.ok(restored);
  assert.equal(restored.version, seeded.version);
  assert.equal(restored.active, true);
  assert.equal(restored.variantId, "whitnack");
  assert.equal(restored.targetRounds, 4);
  assert.deepEqual(restored.players, seeded.players);
  assert.deepEqual(restored.rounds, seeded.rounds);
  assert.deepEqual(restored.draft, seeded.draft);
  assert.equal(restored.editing, null);
  assert.equal(typeof restored.savedAt, "number");

  assert.deepEqual(loadPlayerNames(null), ["Ada", "Ben"]);
  assert.equal(loadVariantId(null), "whitnack");
  assert.equal(loadTargetRounds(null), 4);

  const candidate = resumeCandidate(restored.savedAt + 1000);
  assert.ok(candidate);
  assert.deepEqual(candidate.rounds, seeded.rounds);
  assert.deepEqual(candidate.draft, seeded.draft);

  const before = recomputeGame(seeded);
  const after = recomputeGame(restored);
  assert.equal(after.perPlayer[0].total, before.perPlayer[0].total);
  assert.equal(after.perPlayer[1].total, before.perPlayer[1].total);
  assert.deepEqual(after.leaders, before.leaders);
  assert.equal(after.roundsPlayed, 1);
  assert.equal(after.complete, false);

  // Hand-computed Whitnack deal 1:
  // Ada: 2 clean 1000 + 1 dirty 300 + red3 +100 + melded (50+40=90) - leftover 15 = 1475
  // Ben: 2 dirty 600 + untabled red3 -100 + leftover joker 50 + 2 black 3s 10 = 600-100-60 = 440
  assert.equal(after.perPlayer[0].total, 1475);
  assert.equal(after.perPlayer[1].total, 440);

  resetStorageAdapter();
});

test("FR-5 resume window expires after 24 hours", () => {
  const store = createMemoryStore();
  setStorageAdapter(store);
  saveGame(midGameState());
  const game = loadGame();
  const stale = resumeCandidate(game.savedAt + RESUME_WINDOW_MS + 1);
  assert.equal(stale, null);
  const fresh = resumeCandidate(game.savedAt + 60 * 1000);
  assert.ok(fresh);
  resetStorageAdapter();
});

test("clearGame removes only the game key", () => {
  const store = createMemoryStore();
  setStorageAdapter(store);
  savePlayerNames(["Ada", "Ben"]);
  saveGame(midGameState());
  clearGame();
  assert.equal(loadGame(), null);
  assert.deepEqual(loadPlayerNames(null), ["Ada", "Ben"]);
  resetStorageAdapter();
});

test("scoreRound still agrees after a storage round-trip", () => {
  const store = createMemoryStore();
  setStorageAdapter(store);
  const seeded = midGameState();
  saveGame(seeded);
  const dump = store.snapshot();
  resetStorageAdapter();
  setStorageAdapter(createMemoryStore(dump));
  const restored = loadGame();
  const a = scoreRound(restored.rounds[0].players.p1, VARIANTS.whitnack);
  const b = scoreRound(seeded.rounds[0].players.p1, VARIANTS.whitnack);
  assert.equal(a.total, b.total);
  assert.equal(a.total, 1475);
  resetStorageAdapter();
});
