/**
 * FR-10: scoring is a pure client module. This file imports the engine
 * with no network and asserts scoreRound still runs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreRound, getVariant } from "../../src/engine/hand-and-foot.js";

test("scoreRound works with no network (1 clean pile = 500 Whitnack)", () => {
  const b = scoreRound({ cleanPiles: 1 }, getVariant("whitnack"));
  assert.equal(b.total, 500);
  assert.equal(b.cleanBonus, 500);
});
