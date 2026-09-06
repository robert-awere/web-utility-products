/**
 * Hand-computed test vectors from Pagat Hand and Foot
 * https://www.pagat.com/rummy/handfoot.html retrieved 2026-08-16.
 *
 * Run: node --test src/engine/hand-and-foot.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_VALUES,
  VARIANTS,
  RULES_SOURCE,
  cardPoints,
  netCardPointsFromCounts,
  scoreRound,
  canClaimGoingOut,
  initialMeldRequirement,
  recomputeGame,
  leaderIds,
  formatResultsText,
  emptyRoundInput,
  emptyCardCounts,
  getVariant,
  DEFAULT_VARIANT_ID,
} from "./hand-and-foot.js";

const W = VARIANTS.whitnack;
const S = VARIANTS.simpson;
const K = VARIANTS.saskatchewan;

function counts(partial) {
  return { ...emptyCardCounts(), ...partial };
}

function input(partial) {
  return { ...emptyRoundInput(), ...partial };
}

test("rules source is the fetched Pagat page", () => {
  assert.equal(RULES_SOURCE.url, "https://www.pagat.com/rummy/handfoot.html");
  assert.equal(RULES_SOURCE.retrieved, "2026-08-16");
  assert.equal(DEFAULT_VARIANT_ID, "whitnack");
});

test("card values match Pagat / Whitnack table", () => {
  assert.equal(CARD_VALUES.jokers, 50);
  assert.equal(CARD_VALUES.twosAndAces, 20);
  assert.equal(CARD_VALUES.eightThroughKing, 10);
  assert.equal(CARD_VALUES.fourThroughSeven, 5);
  assert.equal(CARD_VALUES.blackThrees, 5);
});

// --- Vector 1: empty deal ---
test("V1 empty deal scores 0 (Whitnack)", () => {
  const b = scoreRound(emptyRoundInput(), W);
  assert.equal(b.total, 0);
  assert.equal(b.netCards, 0);
  assert.equal(b.outBonus, 0);
});

// --- Vector 2: one natural / clean pile ---
// Pagat: Each complete "Clean" Pile of 7 cards = 500
test("V2 one clean pile is 500 (Whitnack natural canasta)", () => {
  const b = scoreRound(input({ cleanPiles: 1 }), W);
  assert.equal(b.cleanBonus, 500);
  assert.equal(b.total, 500);
});

// --- Vector 3: one mixed / dirty pile ---
// Pagat: Each complete "Dirty" Pile of 7 cards = 300
test("V3 one dirty pile is 300 (Whitnack mixed canasta)", () => {
  const b = scoreRound(input({ dirtyPiles: 1 }), W);
  assert.equal(b.dirtyBonus, 300);
  assert.equal(b.total, 300);
});

// --- Vector 4: natural vs mixed ---
// 1 clean + 1 dirty = 800; 2 clean = 1000; 2 dirty = 600
test("V4 mixed canasta vs natural canasta (Whitnack)", () => {
  const mixedPair = scoreRound(input({ cleanPiles: 1, dirtyPiles: 1 }), W);
  const twoNatural = scoreRound(input({ cleanPiles: 2 }), W);
  const twoMixed = scoreRound(input({ dirtyPiles: 2 }), W);
  assert.equal(mixedPair.total, 800);
  assert.equal(twoNatural.total, 1000);
  assert.equal(twoMixed.total, 600);
  assert.ok(twoNatural.total > mixedPair.total);
  assert.ok(mixedPair.total > twoMixed.total);
});

// --- Vector 5: wild pile ---
// Pagat: Each complete "Wild" Pile of 7 cards = 1500
test("V5 one wild pile is 1500 (Whitnack)", () => {
  const b = scoreRound(input({ wildPiles: 1 }), W);
  assert.equal(b.wildBonus, 1500);
  assert.equal(b.total, 1500);
});

// --- Vector 6: going-out bonus ---
// Pagat: For "Going Out" = 100. Only the side that goes out scores it.
test("V6 going-out bonus is 100 (Whitnack)", () => {
  const out = scoreRound(input({ wentOut: true }), W);
  const notOut = scoreRound(input({ wentOut: false }), W);
  assert.equal(out.outBonus, 100);
  assert.equal(out.total, 100);
  assert.equal(notOut.outBonus, 0);
  assert.equal(notOut.total, 0);
});

// --- Vector 7: red 3s tabled ---
// Pagat: Each Red Three = 100 if placed face up with melds
test("V7 three tabled red 3s are +300 (Whitnack)", () => {
  const b = scoreRound(input({ redThreesTabled: 3 }), W);
  assert.equal(b.redThreeScore, 300);
  assert.equal(b.total, 300);
});

// --- Vector 8: red 3s untabled (penalty / negative) ---
// Pagat: red threes count minus 100 if not laid (e.g. still in the foot)
test("V8 two untabled red 3s are −200 (Whitnack penalty)", () => {
  const b = scoreRound(input({ redThreesUntabled: 2 }), W);
  assert.equal(b.redThreeScore, -200);
  assert.equal(b.total, -200);
});

// --- Vector 9: card points melded minus leftover ---
// 2 jokers + 1 ace melded = 50+50+20 = 120
// 4 leftover black threes = 20 against
// plus 1 clean pile 500 → 600
test("V9 card points: 2 jokers + ace melded, 4 leftover black 3s, 1 clean = 600", () => {
  const b = scoreRound(
    input({
      cleanPiles: 1,
      useCardCounts: true,
      melded: counts({ jokers: 2, twosAndAces: 1 }),
      leftover: counts({ blackThrees: 4 }),
    }),
    W
  );
  assert.equal(cardPoints(counts({ jokers: 2, twosAndAces: 1 })), 120);
  assert.equal(cardPoints(counts({ blackThrees: 4 })), 20);
  assert.equal(b.meldedPts, 120);
  assert.equal(b.leftoverPts, 20);
  assert.equal(b.netCards, 100);
  assert.equal(b.cleanBonus, 500);
  assert.equal(b.total, 600);
});

// --- Vector 10: leftover jokers only (negative / penalty) ---
test("V10 leftover 2 jokers and no melds is −100 (penalty)", () => {
  const b = scoreRound(
    input({
      useCardCounts: true,
      leftover: counts({ jokers: 2 }),
    }),
    W
  );
  assert.equal(b.netCards, -100);
  assert.equal(b.total, -100);
});

// --- Vector 11: Simpson red 3s always −500 ---
// Pagat / Simpson: Red Threes 500 points (these always count against you)
test("V11 Simpson: one tabled red 3 is −500, not +100", () => {
  const tabled = scoreRound(input({ redThreesTabled: 1 }), S);
  const buried = scoreRound(input({ redThreesUntabled: 1 }), S);
  assert.equal(tabled.redThreeScore, -500);
  assert.equal(tabled.total, -500);
  assert.equal(buried.redThreeScore, -500);
  assert.equal(buried.total, -500);
});

// --- Vector 12: Simpson pile bonuses ---
// Pagat / Simpson: Clean 300, Dirty 100; no wild-pile bonus
test("V12 Simpson clean 300 / dirty 100 / wild ignored", () => {
  const clean = scoreRound(input({ cleanPiles: 1 }), S);
  const dirty = scoreRound(input({ dirtyPiles: 1 }), S);
  const wild = scoreRound(input({ wildPiles: 1 }), S);
  assert.equal(clean.total, 300);
  assert.equal(dirty.total, 100);
  assert.equal(wild.wildBonus, 0);
  assert.equal(wild.total, 0);
});

// --- Vector 13: going-out requirements Whitnack vs Saskatchewan ---
test("V13 going-out piles: Whitnack needs 2/2/1; Saskatchewan 1/1/1; Simpson 1/1/0", () => {
  const oneEach = { cleanPiles: 1, dirtyPiles: 1, wildPiles: 1 };
  const whitnackMin = { cleanPiles: 2, dirtyPiles: 2, wildPiles: 1 };
  assert.equal(canClaimGoingOut(oneEach, W).ok, false);
  assert.equal(canClaimGoingOut(whitnackMin, W).ok, true);
  assert.equal(canClaimGoingOut(oneEach, K).ok, true);
  assert.equal(canClaimGoingOut({ cleanPiles: 1, dirtyPiles: 1, wildPiles: 0 }, S).ok, true);
  assert.equal(canClaimGoingOut({ cleanPiles: 1, dirtyPiles: 0, wildPiles: 0 }, S).ok, false);
});

// --- Vector 14: full typical Whitnack deal, hand-computed ---
// 2 clean = 1000
// 2 dirty = 600
// 1 wild = 1500
// going out = 100
// 3 tabled red 3s = 300
// melded: 2 jokers (100) + 2 twos/aces (40) + 4 eights-kings (40) = 180
// leftover: 5 fours-sevens = 25
// net cards = 155
// total = 1000+600+1500+100+300+155 = 3655
test("V14 full Whitnack deal hand-computed total 3655", () => {
  const b = scoreRound(
    input({
      cleanPiles: 2,
      dirtyPiles: 2,
      wildPiles: 1,
      wentOut: true,
      redThreesTabled: 3,
      useCardCounts: true,
      melded: counts({ jokers: 2, twosAndAces: 2, eightThroughKing: 4 }),
      leftover: counts({ fourThroughSeven: 5 }),
    }),
    W
  );
  assert.equal(b.cleanBonus, 1000);
  assert.equal(b.dirtyBonus, 600);
  assert.equal(b.wildBonus, 1500);
  assert.equal(b.outBonus, 100);
  assert.equal(b.redThreeScore, 300);
  assert.equal(b.meldedPts, 180);
  assert.equal(b.leftoverPts, 25);
  assert.equal(b.netCards, 155);
  assert.equal(b.total, 3655);
  assert.equal(b.goingOutCheck.ok, true);
});

// --- Vector 15: stock-out — piles score, no going-out bonus ---
// Pagat End of the play: if stock is depleted, no one gets the bonus for going out
test("V15 stock-out: piles score, going-out bonus is 0", () => {
  const b = scoreRound(
    input({
      cleanPiles: 2,
      dirtyPiles: 1,
      wildPiles: 1,
      wentOut: false,
      redThreesTabled: 1,
    }),
    W
  );
  assert.equal(b.cleanBonus, 1000);
  assert.equal(b.dirtyBonus, 300);
  assert.equal(b.wildBonus, 1500);
  assert.equal(b.outBonus, 0);
  assert.equal(b.redThreeScore, 100);
  assert.equal(b.total, 2900);
});

// --- Vector 16: initial meld ladder ---
// Pagat: Round 1=50, 2=90, 3=120, 4=150. Red 3s and pile bonuses do not count.
test("V16 initial meld minima 50 / 90 / 120 / 150", () => {
  assert.equal(initialMeldRequirement(1, W), 50);
  assert.equal(initialMeldRequirement(2, W), 90);
  assert.equal(initialMeldRequirement(3, W), 120);
  assert.equal(initialMeldRequirement(4, W), 150);
  assert.equal(initialMeldRequirement(1, S), 50);
  assert.equal(initialMeldRequirement(4, K), 150);
});

// --- Vector 17: net card points helper and raw net path ---
test("V17 netCardPointsFromCounts and raw netCardPoints path agree", () => {
  const melded = counts({ eightThroughKing: 7 }); // 70
  const leftover = counts({ fourThroughSeven: 3 }); // 15
  assert.equal(netCardPointsFromCounts(melded, leftover), 55);
  const fromCounts = scoreRound(input({ useCardCounts: true, melded, leftover }), W);
  const fromRaw = scoreRound(input({ useCardCounts: false, netCardPoints: 55 }), W);
  assert.equal(fromCounts.total, 55);
  assert.equal(fromRaw.total, 55);
});

// --- Vector 18: game recompute, leader, four-deal win ---
test("V18 recomputeGame totals, leader, and completion after 4 deals", () => {
  const state = {
    variantId: "whitnack",
    targetRounds: 4,
    players: [
      { id: "p1", name: "Ada" },
      { id: "p2", name: "Ben" },
    ],
    rounds: [
      {
        players: {
          p1: input({ cleanPiles: 1 }),
          p2: input({ dirtyPiles: 1 }),
        },
      },
      {
        players: {
          p1: input({ cleanPiles: 1, wentOut: true }),
          p2: input({ redThreesUntabled: 1 }),
        },
      },
      {
        players: {
          p1: input({ dirtyPiles: 2 }),
          p2: input({ cleanPiles: 2 }),
        },
      },
      {
        players: {
          p1: input({ wildPiles: 1 }),
          p2: input({ cleanPiles: 1, dirtyPiles: 1 }),
        },
      },
    ],
  };
  // Ada: 500 + (500+100) + 600 + 1500 = 3200
  // Ben: 300 + (−100) + 1000 + 800 = 2000
  const g = recomputeGame(state);
  assert.equal(g.perPlayer[0].total, 3200);
  assert.equal(g.perPlayer[1].total, 2000);
  assert.deepEqual(g.leaders, ["p1"]);
  assert.equal(g.complete, true);
  const text = formatResultsText(state, g);
  assert.match(text, /Ada: 3200/);
  assert.match(text, /Winner after 4 deals: Ada/);
});

// --- Vector 19: Saskatchewan uses Whitnack bonuses, different go-out gate ---
test("V19 Saskatchewan 1 clean + 1 dirty + 1 wild + out = 2400", () => {
  const src = input({ cleanPiles: 1, dirtyPiles: 1, wildPiles: 1, wentOut: true });
  const b = scoreRound(src, K);
  assert.equal(b.total, 500 + 300 + 1500 + 100);
  assert.equal(b.goingOutCheck.ok, true);
  assert.equal(scoreRound(src, W).goingOutCheck.ok, false);
});

// --- Vector 20: tie for leader ---
test("V20 tied leaders both returned", () => {
  const rows = [
    { id: "a", total: 100 },
    { id: "b", total: 100 },
    { id: "c", total: 40 },
  ];
  assert.deepEqual(leaderIds(rows), ["a", "b"]);
});

test("getVariant falls back to Whitnack", () => {
  assert.equal(getVariant("nope").id, "whitnack");
  assert.equal(getVariant(undefined).id, "whitnack");
});
