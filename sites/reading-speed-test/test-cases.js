/* =============================================================================
   Spec test cases — /specs/reading-speed-test.md  ("Test cases" 1–8)
   Run:  node test-cases.js            (exit 0 = pass, 1 = any failure)
   Dev tool only; index.html never loads this file.

   Asserts against the SHIPPED bytes of engine.js and passages.js, so a passage
   edit that breaks the word-count or question contract fails here first.
   PASSAGES=<path> overrides the passages file (used while the data is drafted).
   ============================================================================= */
'use strict';
var assert = require('assert');
var path = require('path');
var E = require('./engine.js');
var passagesPath = process.env.PASSAGES || './passages.js';
var P = require(path.resolve(__dirname, passagesPath));
if (!Array.isArray(P) && P && Array.isArray(P.PASSAGES)) P = P.PASSAGES;

var pass = 0, fail = 0;
function check(label, fn) {
  try { fn(); pass++; console.log('   PASS  ' + label); }
  catch (e) { fail++; console.log('   FAIL  ' + label + '\n         ' + (e && e.message)); }
}
var eq = assert.strictEqual;
var deq = assert.deepStrictEqual;

console.log('\n=== CASE 1 — 250 words in 60,000 ms ===');
check('wpm = 250',                   function () { eq(E.wpm(250, 60000), 250); });
check('band "Average adult"',        function () { eq(E.band(250).label, 'Average adult'); });
check('vsAverage = +5',              function () { eq(E.vsAverage(250), 5); });

console.log('\n=== CASE 2 — 250 words in 30,000 ms ===');
check('wpm = 500',                   function () { eq(E.wpm(250, 30000), 500); });
check('band "Fast"',                 function () { eq(E.band(500).label, 'Fast'); });

console.log('\n=== CASE 3 — 280 words in 120,000 ms ===');
check('wpm = 140',                   function () { eq(E.wpm(280, 120000), 140); });
check('band "Developing"',           function () { eq(E.band(140).label, 'Developing'); });
check('vsAverage = -41',             function () { eq(E.vsAverage(140), -41); });

console.log('\n=== CASE 4 — effectiveWpm ===');
check('effectiveWpm(300, 4) = 240',  function () { eq(E.effectiveWpm(300, 4), 240); });
check('effectiveWpm(300, 0) = 0',    function () { eq(E.effectiveWpm(300, 0), 0); });
check('effectiveWpm(300, 5) = 300',  function () { eq(E.effectiveWpm(300, 5), 300); });

console.log('\n=== CASE 5 — timeToRead ===');
check('90,000 words @ 250 wpm = 6 h 0 min',
  function () { deq(E.timeToRead(90000, 250), { hours: 6, minutes: 0 }); });
check('1,084,170 words @ 238 wpm = 75 h 55 min',
  function () { deq(E.timeToRead(1084170, 238), { hours: 75, minutes: 55 }); });

console.log('\n=== CASE 6 — share link encode/decode ===');
var ids = P.map(function (x) { return x.id; });
var validId = function (id) { return ids.indexOf(id) !== -1; };
check('round trip {p, wpm:312, c:4}', function () {
  var q = E.encodeShare({ p: ids[0], wpm: 312, c: 4 });
  eq(q, '?p=' + ids[0] + '&wpm=312&c=4');
  deq(E.decodeShare(q, ids), { p: ids[0], wpm: 312, c: 4 });
  deq(E.decodeShare(q, validId), { p: ids[0], wpm: 312, c: 4 });
});
check('decode rejects wpm=abc',      function () { eq(E.decodeShare('?p=' + ids[0] + '&wpm=abc&c=4', ids), null); });
check('decode rejects c=9',          function () { eq(E.decodeShare('?p=' + ids[0] + '&wpm=300&c=9', ids), null); });
check('decode rejects unknown p',    function () { eq(E.decodeShare('?p=not-a-passage&wpm=300&c=4', ids), null); });
check('decode rejects garbage',      function () {
  eq(E.decodeShare('', ids), null);
  eq(E.decodeShare('?x=1', ids), null);
  eq(E.decodeShare('?p=%E0%A4%A&wpm=1&c=1', ids), null);
  eq(E.decodeShare('?p=' + ids[0] + '&wpm=0&c=1', ids), null);
});
check('bare ?p=<id> is a passage pick, not a challenge', function () {
  deq(E.decodeShare('?p=' + ids[0], ids), { p: ids[0], wpm: null, c: null });
});
check('encode refuses out-of-range payloads', function () {
  eq(E.encodeShare({ p: ids[0], wpm: 300, c: 9 }), '');
  eq(E.encodeShare({ p: 'Bad Id!', wpm: 300, c: 1 }), '');
});

console.log('\n=== CASE 7 — edge cases ===');
check('wpm(words, 0) = 0',           function () { eq(E.wpm(250, 0), 0); });
check('wordCount handles blanks',    function () {
  eq(E.wordCount('  one   two\n\nthree '), 3);
  eq(E.wordCount(''), 0);
});
check('isPlausible(3000, 900).ok === false', function () { eq(E.isPlausible(3000, 900).ok, false); });
check('isPlausible flags skimming above 1200 wpm', function () {
  eq(E.isPlausible(20000, 1300).reason, 'skimming');
  eq(E.isPlausible(60000, 250).ok, true);
});
check('band boundaries', function () {
  eq(E.band(149).label, 'Developing');
  eq(E.band(150).label, 'Below average');
  eq(E.band(199).label, 'Below average');
  eq(E.band(200).label, 'Average adult');
  eq(E.band(299).label, 'Average adult');
  eq(E.band(300).label, 'Above average');
  eq(E.band(399).label, 'Above average');
  eq(E.band(400).label, 'Fast');
  eq(E.band(599).label, 'Fast');
  eq(E.band(600).label, 'Very fast (check comprehension)');
});
check('BENCHMARK = 238',             function () { eq(E.BENCHMARK, 238); });

console.log('\n=== CASE 8 — every passage honours the data contract ===');
check('passages file exports an array of 6', function () {
  assert.ok(Array.isArray(P), 'not an array');
  eq(P.length, 6);
});
check('passage ids are unique and url-safe', function () {
  var seen = {};
  P.forEach(function (x) {
    assert.ok(/^[a-z0-9][a-z0-9-]{0,39}$/.test(x.id), 'bad id ' + x.id);
    assert.ok(!seen[x.id], 'duplicate id ' + x.id);
    seen[x.id] = true;
  });
});
P.forEach(function (x) {
  check('"' + x.id + '": 230–290 words, 5 questions x 4 options, answer 0–3', function () {
    var n = E.wordCount(x.text);
    assert.ok(typeof x.title === 'string' && x.title.length > 0, 'missing title');
    assert.ok(n >= 230 && n <= 290, 'word count ' + n);
    assert.ok(Array.isArray(x.questions), 'questions not an array');
    eq(x.questions.length, 5, 'question count ' + x.questions.length);
    x.questions.forEach(function (q, i) {
      assert.ok(typeof q.q === 'string' && q.q.length > 0, 'q' + i + ' empty');
      eq(q.options.length, 4, 'q' + i + ' option count');
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, 'q' + i + ' answer ' + q.answer);
    });
  });
});
check('correct answers do not all sit in the same slot', function () {
  var slots = {};
  P.forEach(function (x) { x.questions.forEach(function (q) { slots[q.answer] = true; }); });
  assert.ok(Object.keys(slots).length >= 2, 'all answers in slot ' + Object.keys(slots)[0]);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed' + (pass + fail >= 15 ? '' : '  (fewer than 15 assertions!)'));
process.exit(fail === 0 && pass + fail >= 15 ? 0 : 1);
