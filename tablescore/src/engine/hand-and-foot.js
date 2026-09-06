/**
 * Hand and Foot scoring engine — pure functions only.
 * Rules source: John McLeod, "Hand and Foot", Pagat,
 * https://www.pagat.com/rummy/handfoot.html
 * Retrieved 16 August 2026.
 *
 * Default variant: Bill Whitnack partnership rules (Pagat: "the most usual version").
 * Other variants are named from the same page (Steve Simpson; Saskatchewan / Dave Petrie).
 * No scoring arithmetic belongs in UI code — call these functions instead.
 */

export const RULES_SOURCE = {
  title: "Hand and Foot — Pagat (John McLeod)",
  url: "https://www.pagat.com/rummy/handfoot.html",
  retrieved: "2026-08-16",
  defaultContributor: "Bill Whitnack",
};

/** Card point values from Pagat / Whitnack "Values of the Cards". */
export const CARD_VALUES = Object.freeze({
  jokers: 50,
  twosAndAces: 20,
  eightThroughKing: 10,
  fourThroughSeven: 5,
  blackThrees: 5,
});

export const CARD_FIELDS = Object.freeze([
  { key: "jokers", label: "Jokers", hint: "50 each" },
  { key: "twosAndAces", label: "Twos & aces", hint: "20 each" },
  { key: "eightThroughKing", label: "Eights through kings", hint: "10 each" },
  { key: "fourThroughSeven", label: "Fours through sevens", hint: "5 each" },
  { key: "blackThrees", label: "Black threes", hint: "5 each" },
]);

/**
 * Named variants from the cited Pagat page.
 * Do not add unpublished house rules here.
 */
export const VARIANTS = Object.freeze({
  whitnack: Object.freeze({
    id: "whitnack",
    name: "Whitnack partnership",
    shortName: "Whitnack",
    sourceNote:
      "Pagat partnership rules contributed by Bill Whitnack — described as the most usual version.",
    default: true,
    cleanPileBonus: 500,
    dirtyPileBonus: 300,
    wildPileBonus: 1500,
    goingOutBonus: 100,
    redThreeTabled: 100,
    redThreeUntabled: -100,
    goingOutRequires: Object.freeze({ clean: 2, dirty: 2, wild: 1 }),
    initialMeld: Object.freeze([50, 90, 120, 150]),
    usesWildPiles: true,
    redThreeNote:
      "Red threes are +100 if laid face up with your melds, −100 if still in hand or foot.",
    goingOutNote:
      "Going out requires two dirty piles, two clean piles, and one wild pile (plus partner foot-play and permission at the table).",
  }),
  simpson: Object.freeze({
    id: "simpson",
    name: "Steve Simpson (individuals)",
    shortName: "Simpson",
    sourceNote:
      "Pagat / Steve Simpson individual rules (learned from Rob Groz). Red threes always count against you.",
    default: false,
    cleanPileBonus: 300,
    dirtyPileBonus: 100,
    wildPileBonus: 0,
    goingOutBonus: 100,
    redThreeTabled: -500,
    redThreeUntabled: -500,
    goingOutRequires: Object.freeze({ clean: 1, dirty: 1, wild: 0 }),
    initialMeld: Object.freeze([50, 90, 120, 150]),
    usesWildPiles: false,
    redThreeNote:
      "Every red three is −500, whether or not it was laid down.",
    goingOutNote:
      "Going out requires at least one clean pile and one dirty pile, and a discard.",
  }),
  saskatchewan: Object.freeze({
    id: "saskatchewan",
    name: "Saskatchewan",
    shortName: "Saskatchewan",
    sourceNote:
      "Pagat / Dave Petrie Saskatchewan rules. Going-out requirement is one clean, one dirty, and one wild canasta. Pile bonuses are not restated on that section; this engine uses the Whitnack bonus table (500 / 300 / 1500 / 100) and flags that assumption.",
    default: false,
    cleanPileBonus: 500,
    dirtyPileBonus: 300,
    wildPileBonus: 1500,
    goingOutBonus: 100,
    redThreeTabled: 100,
    redThreeUntabled: -100,
    goingOutRequires: Object.freeze({ clean: 1, dirty: 1, wild: 1 }),
    initialMeld: Object.freeze([50, 90, 120, 150]),
    usesWildPiles: true,
    pileBonusAssumption:
      "Saskatchewan text on Pagat does not republish pile bonuses; Whitnack 500/300/1500 is applied.",
    redThreeNote:
      "Red-three treatment is not restated in the Saskatchewan section; Whitnack +100 / −100 is applied.",
    goingOutNote:
      "Going out requires at least one clean canasta, one dirty canasta, and one wild-card canasta.",
  }),
});

export const DEFAULT_VARIANT_ID = "whitnack";
export const DEFAULT_TARGET_ROUNDS = 4;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 8;

export function emptyCardCounts() {
  return {
    jokers: 0,
    twosAndAces: 0,
    eightThroughKing: 0,
    fourThroughSeven: 0,
    blackThrees: 0,
  };
}

export function emptyRoundInput() {
  return {
    cleanPiles: 0,
    dirtyPiles: 0,
    wildPiles: 0,
    redThreesTabled: 0,
    redThreesUntabled: 0,
    melded: emptyCardCounts(),
    leftover: emptyCardCounts(),
    useCardCounts: true,
    netCardPoints: 0,
    wentOut: false,
  };
}

export function getVariant(id) {
  if (id && VARIANTS[id]) return VARIANTS[id];
  return VARIANTS[DEFAULT_VARIANT_ID];
}

export function listVariants() {
  return Object.freeze([VARIANTS.whitnack, VARIANTS.simpson, VARIANTS.saskatchewan]);
}

function asInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function asNonNegInt(value) {
  return Math.max(0, asInt(value));
}

/**
 * Point value of a bag of cards, using Pagat / Whitnack card values.
 * Red threes are not included — they have their own bonus line.
 */
export function cardPoints(counts) {
  const c = counts || emptyCardCounts();
  return (
    asNonNegInt(c.jokers) * CARD_VALUES.jokers +
    asNonNegInt(c.twosAndAces) * CARD_VALUES.twosAndAces +
    asNonNegInt(c.eightThroughKing) * CARD_VALUES.eightThroughKing +
    asNonNegInt(c.fourThroughSeven) * CARD_VALUES.fourThroughSeven +
    asNonNegInt(c.blackThrees) * CARD_VALUES.blackThrees
  );
}

/**
 * Net card points: melded count for you, leftover hand/foot against you.
 */
export function netCardPointsFromCounts(melded, leftover) {
  return cardPoints(melded) - cardPoints(leftover);
}

export function initialMeldRequirement(roundNumber, variant) {
  const v = variant && variant.initialMeld ? variant : getVariant(variant);
  const idx = Math.min(Math.max(asInt(roundNumber) - 1, 0), v.initialMeld.length - 1);
  return v.initialMeld[idx];
}

/**
 * Whether pile counts meet the selected variant's going-out requirement.
 * Table facts (partner already in the foot, permission) are not modeled.
 */
export function canClaimGoingOut(input, variant) {
  const v = variant && variant.goingOutRequires ? variant : getVariant(variant);
  const req = v.goingOutRequires;
  const clean = asNonNegInt(input && input.cleanPiles);
  const dirty = asNonNegInt(input && input.dirtyPiles);
  const wild = asNonNegInt(input && input.wildPiles);
  const missing = [];
  if (clean < req.clean) missing.push(`${req.clean} clean pile${req.clean === 1 ? "" : "s"} (have ${clean})`);
  if (dirty < req.dirty) missing.push(`${req.dirty} dirty pile${req.dirty === 1 ? "" : "s"} (have ${dirty})`);
  if (req.wild > 0 && wild < req.wild) {
    missing.push(`${req.wild} wild pile${req.wild === 1 ? "" : "s"} (have ${wild})`);
  }
  return { ok: missing.length === 0, missing, requires: req };
}

/**
 * Score one player's (or one partnership's) deal.
 * @returns breakdown with a `total`. UI must display these numbers, not recompute them.
 */
export function scoreRound(input, variant) {
  const v = variant && typeof variant.cleanPileBonus === "number" ? variant : getVariant(variant);
  const src = input || emptyRoundInput();
  const cleanPiles = asNonNegInt(src.cleanPiles);
  const dirtyPiles = asNonNegInt(src.dirtyPiles);
  const wildPiles = v.usesWildPiles ? asNonNegInt(src.wildPiles) : 0;
  const redThreesTabled = asNonNegInt(src.redThreesTabled);
  const redThreesUntabled = asNonNegInt(src.redThreesUntabled);
  const wentOut = Boolean(src.wentOut);

  let meldedPts = 0;
  let leftoverPts = 0;
  let netCards;
  if (src.useCardCounts) {
    meldedPts = cardPoints(src.melded);
    leftoverPts = cardPoints(src.leftover);
    netCards = meldedPts - leftoverPts;
  } else {
    netCards = asInt(src.netCardPoints);
  }

  const cleanBonus = cleanPiles * v.cleanPileBonus;
  const dirtyBonus = dirtyPiles * v.dirtyPileBonus;
  const wildBonus = wildPiles * v.wildPileBonus;
  const outBonus = wentOut ? v.goingOutBonus : 0;
  const redThreeScore =
    redThreesTabled * v.redThreeTabled + redThreesUntabled * v.redThreeUntabled;
  const pileBonus = cleanBonus + dirtyBonus + wildBonus;
  const total = netCards + pileBonus + outBonus + redThreeScore;
  const goingOutCheck = canClaimGoingOut(
    { cleanPiles, dirtyPiles, wildPiles },
    v
  );

  return Object.freeze({
    cleanPiles,
    dirtyPiles,
    wildPiles,
    redThreesTabled,
    redThreesUntabled,
    wentOut,
    meldedPts,
    leftoverPts,
    netCards,
    pileBonus,
    cleanBonus,
    dirtyBonus,
    wildBonus,
    outBonus,
    redThreeScore,
    total,
    goingOutCheck,
    variantId: v.id,
  });
}

export function sumTotals(roundTotals) {
  return (roundTotals || []).reduce((s, n) => s + asInt(n), 0);
}

/**
 * Recompute an entire game from committed rounds.
 * `state.rounds[i].players[playerId]` is a RoundInput.
 */
export function recomputeGame(state) {
  const variant = getVariant(state && state.variantId);
  const players = (state && state.players) || [];
  const rounds = (state && state.rounds) || [];
  const targetRounds = clampInt(state && state.targetRounds, MIN_ROUNDS, MAX_ROUNDS, DEFAULT_TARGET_ROUNDS);

  const perPlayer = players.map((p) => {
    const breakdowns = rounds.map((round) =>
      scoreRound((round && round.players && round.players[p.id]) || emptyRoundInput(), variant)
    );
    const total = breakdowns.reduce((s, b) => s + b.total, 0);
    return {
      id: p.id,
      name: p.name,
      breakdowns,
      total,
    };
  });

  const leaders = leaderIds(perPlayer);
  const complete = rounds.length >= targetRounds;
  return {
    variant,
    targetRounds,
    roundsPlayed: rounds.length,
    perPlayer,
    leaders,
    complete,
  };
}

export function leaderIds(perPlayer) {
  if (!perPlayer || perPlayer.length === 0) return [];
  let best = -Infinity;
  for (const p of perPlayer) {
    if (p.total > best) best = p.total;
  }
  return perPlayer.filter((p) => p.total === best).map((p) => p.id);
}

export function clampInt(value, min, max, fallback) {
  const n = asInt(value);
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

export function sanitizePlayerCount(n) {
  return clampInt(n, MIN_PLAYERS, MAX_PLAYERS, MIN_PLAYERS);
}

/**
 * Plain-text results for clipboard. Presentation only — totals already computed.
 */
export function formatResultsText(state, computed) {
  const lines = [];
  const v = computed.variant;
  lines.push("Hand and Foot — TableScore");
  lines.push(`Variant: ${v.name}`);
  lines.push(`Rules: ${RULES_SOURCE.url} (retrieved ${RULES_SOURCE.retrieved})`);
  lines.push(`Rounds: ${computed.roundsPlayed} of ${computed.targetRounds}`);
  lines.push("");
  const ranked = computed.perPlayer.slice().sort((a, b) => b.total - a.total);
  ranked.forEach((p, i) => {
    const mark = computed.leaders.includes(p.id) ? " (leader)" : "";
    lines.push(`${i + 1}. ${p.name}: ${p.total}${mark}`);
  });
  if (computed.roundsPlayed > 0) {
    lines.push("");
    computed.perPlayer[0].breakdowns.forEach((_, r) => {
      const cells = computed.perPlayer
        .map((p) => `${p.name} ${p.breakdowns[r].total}`)
        .join(", ");
      lines.push(`Deal ${r + 1}: ${cells}`);
    });
  }
  if (computed.complete) {
    const names = computed.perPlayer
      .filter((p) => computed.leaders.includes(p.id))
      .map((p) => p.name);
    lines.push("");
    if (names.length === 1) lines.push(`Winner after ${computed.targetRounds} deals: ${names[0]}`);
    else lines.push(`Tied after ${computed.targetRounds} deals: ${names.join(", ")}`);
  }
  return lines.join("\n");
}

export function defaultPlayerNames() {
  return ["Player 1", "Player 2"];
}

export function makePlayerId(index) {
  return `p${index + 1}`;
}
