/* =============================================================================
   Reading Speed Test — engine.js
   Pure functions only. No DOM, no storage, no passage data. app.js wires it to
   the page; test-cases.js runs it under Node against the shipped bytes.
   Spec: /specs/reading-speed-test.md
   ============================================================================= */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------------------
     DATA — the only numbers in this file that are "facts" rather than math.
     BENCHMARK: Brysbaert (2019), Journal of Memory and Language, meta-analysis of
     190 studies. Average adult silent reading rate, non-fiction: 238 wpm.
     EQUIVALENTS: word counts used for the "at your speed you'd finish…" lines.
     --------------------------------------------------------------------------- */
  var BENCHMARK = 238;
  var EQUIVALENTS = [
    { key: 'novel',  label: 'a 300-page novel',             words: 90000 },
    { key: 'potter', label: 'the whole Harry Potter series', words: 1084170 },
    { key: 'war',    label: 'War and Peace',                 words: 587000 }
  ];

  /* Bands by raw wpm. Boundaries are inclusive at the low end. */
  var BANDS = [
    { min: 0,   key: 'developing', label: 'Developing',
      note: 'Below the range most adults read at. Comprehension matters more than speed here, so take your time.' },
    { min: 150, key: 'below',      label: 'Below average',
      note: 'A little under the adult average. Steady and careful, and often with strong recall.' },
    { min: 200, key: 'average',    label: 'Average adult',
      note: 'Right where most adults land for non-fiction. Nothing to fix.' },
    { min: 300, key: 'above',      label: 'Above average',
      note: 'Faster than most adults while still reading every word.' },
    { min: 400, key: 'fast',       label: 'Fast',
      note: 'A genuinely quick reader. Few people sustain this with full comprehension.' },
    { min: 600, key: 'veryfast',   label: 'Very fast (check comprehension)',
      note: 'Rare for word-by-word reading. If your comprehension held up, impressive; if not, you were probably skimming.' }
  ];

  /* ---------------------------------------------------------------------------
     Math
     --------------------------------------------------------------------------- */

  /* Word count is always computed from the text; stored counts are never trusted. */
  function wordCount(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  /* words / minutes, rounded. 0 when the clock did not run. */
  function wpm(words, ms) {
    words = Number(words); ms = Number(ms);
    if (!(ms > 0) || !(words > 0)) return 0;
    return Math.round(words / (ms / 60000));
  }

  /* Speed scaled by the share of questions answered correctly. */
  function effectiveWpm(rawWpm, correct, total) {
    total = total === undefined ? 5 : Number(total);
    rawWpm = Number(rawWpm); correct = Number(correct);
    if (!(total > 0) || !(rawWpm > 0) || !(correct > 0)) return 0;
    return Math.round(rawWpm * (correct / total));
  }

  function band(rawWpm) {
    rawWpm = Number(rawWpm) || 0;
    var hit = BANDS[0];
    for (var i = 0; i < BANDS.length; i++) {
      if (rawWpm >= BANDS[i].min) hit = BANDS[i];
    }
    return { key: hit.key, label: hit.label, note: hit.note };
  }

  /* Signed percent vs the benchmark adult, as an int: +5, -41, 0. */
  function vsAverage(rawWpm, benchmark) {
    benchmark = benchmark === undefined ? BENCHMARK : Number(benchmark);
    rawWpm = Number(rawWpm);
    if (!(benchmark > 0) || !(rawWpm >= 0)) return 0;
    return Math.round(((rawWpm / benchmark) - 1) * 100);
  }

  /* How long a body of text takes at a given speed. Rounded to the minute. */
  function timeToRead(words, rawWpm) {
    words = Number(words); rawWpm = Number(rawWpm);
    if (!(rawWpm > 0) || !(words > 0)) return { hours: 0, minutes: 0 };
    var totalMinutes = Math.round(words / rawWpm);
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
  }

  /* ---------------------------------------------------------------------------
     Share payload: ?p=<id>&wpm=<int>&c=<0-5>  — nothing else, ever.
     --------------------------------------------------------------------------- */
  var ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
  var WPM_MAX = 5000; /* anything above is noise, not a reading speed */

  function encodeShare(payload) {
    payload = payload || {};
    var p = String(payload.p || '');
    var w = Math.round(Number(payload.wpm));
    var c = Math.round(Number(payload.c));
    if (!ID_RE.test(p) || !(w >= 0) || w > WPM_MAX || !(c >= 0) || c > 5) return '';
    return '?p=' + encodeURIComponent(p) + '&wpm=' + w + '&c=' + c;
  }

  /* `isValidId` is either an array of passage ids or a function(id) -> boolean,
     so the engine never has to know the passages. Returns null on anything odd. */
  function decodeShare(queryString, isValidId) {
    var q = String(queryString == null ? '' : queryString);
    if (q.charAt(0) === '?') q = q.slice(1);
    if (!q) return null;
    var params = {};
    q.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? '' : pair.slice(i + 1);
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch (e) { /* malformed escape: skip the pair */ }
    });
    var p = params.p;
    if (!p || !ID_RE.test(p)) return null;
    var valid = typeof isValidId === 'function' ? isValidId(p)
      : Array.isArray(isValidId) ? isValidId.indexOf(p) !== -1
      : true;
    if (!valid) return null;
    /* A bare ?p=<id> is a valid "pick this passage" link with no challenge. */
    if (params.wpm === undefined && params.c === undefined) {
      return { p: p, wpm: null, c: null };
    }
    if (!/^\d{1,4}$/.test(params.wpm || '') || !/^[0-5]$/.test(params.c || '')) return null;
    var w = parseInt(params.wpm, 10);
    if (w < 1 || w > WPM_MAX) return null;
    return { p: p, wpm: w, c: parseInt(params.c, 10) };
  }

  /* ---------------------------------------------------------------------------
     Plausibility — a result we show but flag, or refuse outright.
     --------------------------------------------------------------------------- */
  var MIN_MS = 5000;
  var SKIM_WPM = 1200;

  function isPlausible(ms, rawWpm) {
    ms = Number(ms); rawWpm = Number(rawWpm);
    if (!(ms >= MIN_MS)) {
      return { ok: false, reason: 'too-fast', message: 'That was under five seconds. Read the passage through, then press done.' };
    }
    if (rawWpm > SKIM_WPM) {
      return { ok: false, reason: 'skimming', message: 'That’s skimming territory — a human reading every word rarely exceeds ~600 wpm.' };
    }
    return { ok: true, reason: null, message: '' };
  }

  var API = {
    BENCHMARK: BENCHMARK,
    EQUIVALENTS: EQUIVALENTS,
    BANDS: BANDS,
    MIN_MS: MIN_MS,
    SKIM_WPM: SKIM_WPM,
    wordCount: wordCount,
    wpm: wpm,
    effectiveWpm: effectiveWpm,
    band: band,
    vsAverage: vsAverage,
    timeToRead: timeToRead,
    encodeShare: encodeShare,
    decodeShare: decodeShare,
    isPlausible: isPlausible
  };

  root.Engine = API;
  /* Lets the shipped file be unit-tested under Node without a build step. */
  if (typeof module === 'object' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
