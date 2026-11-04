/* =============================================================================
   Reading Speed Test — app.js (DOM layer)
   Loads after passages.js (data) and engine.js (pure math). Owns the state
   machine idle -> reading -> quiz -> result, the share link, the challenge
   banner, the SVG gauge and the canvas result card. Nothing here is required
   to persist: localStorage is a progressive extra behind try/catch.
   ============================================================================= */
(function () {
  'use strict';
  var E = window.Engine;
  var PASSAGES = window.PASSAGES;
  if (!E || !Array.isArray(PASSAGES) || !PASSAGES.length) return;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    challenge: $('challenge'), challengeText: $('challenge-text'),
    title: $('passage-title'), words: $('passage-words'), veil: $('veil'),
    body: $('passage-body'), readingNote: $('reading-note'),
    controls: $('passage-controls'), change: $('change-passage'),
    primary: $('primary-btn'), hint: $('tool-hint'),
    quiz: $('quiz'), quizHeading: $('quiz-heading'), quizForm: $('quiz-form'),
    questions: $('quiz-questions'), progress: $('quiz-progress'), showResult: $('show-result'),
    result: $('result'), resultHeading: $('result-heading'),
    invalid: $('result-invalid'), invalidText: $('invalid-text'), invalidRetry: $('invalid-retry'),
    resultBody: $('result-body'), gauge: $('gauge'),
    rWpm: $('r-wpm'), rBand: $('r-band'), rBandNote: $('r-band-note'), rComp: $('r-comp'),
    rEff: $('r-eff'), rVs: $('r-vs'), rOutcome: $('r-outcome'), rBest: $('r-best'),
    rFlags: $('r-flags'), rEquiv: $('r-equiv'),
    share: $('share-btn'), copy: $('copy-btn'), download: $('download-btn'),
    another: $('another-btn'), again: $('again-btn'), copyStatus: $('copy-status')
  };
  for (var k in els) { if (!els[k]) return; } /* markup out of sync: fail quietly */

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* no matchMedia */ }

  /* ---------------------------------------------------------------------------
     State
     --------------------------------------------------------------------------- */
  var state = 'idle';          /* idle | reading | quiz | result */
  var passage = null;          /* current passage object */
  var startedAt = 0;           /* performance.now() at Start */
  var elapsedMs = 0;
  var challenge = null;        /* {p, wpm, c} from a share link, or null */
  var lastResult = null;       /* {wpm, correct, effective, band, vs, url} */

  var ids = PASSAGES.map(function (p) { return p.id; });
  function byId(id) {
    for (var i = 0; i < PASSAGES.length; i++) if (PASSAGES[i].id === id) return PASSAGES[i];
    return null;
  }

  /* The share link is built on the page's own address when served over http(s)
     (so preview deployments share correctly) and on the canonical URL otherwise. */
  function baseUrl() {
    if (/^https?:$/.test(location.protocol)) return location.origin + location.pathname;
    var c = document.querySelector('link[rel="canonical"]');
    return c ? c.href : location.href.split('?')[0];
  }

  /* ---------------------------------------------------------------------------
     Gauge geometry — shared by the SVG gauge and the canvas card.
     0..800 wpm sweeps 220 degrees from lower-left to lower-right.
     --------------------------------------------------------------------------- */
  var G = { cx: 100, cy: 100, r: 82, start: 200, sweep: 220, max: 800 };
  function clampWpm(v) { return Math.min(Math.max(Number(v) || 0, 0), G.max); }
  function angleFor(v) { return G.start - G.sweep * (clampWpm(v) / G.max); } /* math degrees */
  function pt(deg, r, cx, cy) {
    var a = deg * Math.PI / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  }
  function arcPath(v0, v1, r) {
    var a0 = angleFor(v0), a1 = angleFor(v1);
    var p0 = pt(a0, r, G.cx, G.cy), p1 = pt(a1, r, G.cx, G.cy);
    var large = (a0 - a1) > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
      ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function needleRotation(v) { return 90 - angleFor(v); } /* CSS degrees, clockwise */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var a in attrs) el.setAttribute(a, attrs[a]);
    return el;
  }

  /* Draw the static parts once; the needle is rotated per result. */
  var needle = null;
  function buildGauge() {
    var svg = els.gauge;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.appendChild(svgEl('path', { 'class': 'gauge-track', d: arcPath(0, G.max, G.r) }));
    /* Band segments alternate opacity so the steps read without a legend. */
    var stops = E.BANDS.map(function (b) { return b.min; }).concat([G.max]);
    for (var i = 0; i < stops.length - 1; i++) {
      svg.appendChild(svgEl('path', {
        'class': 'gauge-band', d: arcPath(stops[i], stops[i + 1], G.r),
        opacity: (i % 2 === 0 ? 0.28 : 0.5).toString()
      }));
    }
    /* Ticks + labels at the band boundaries and the ends. */
    var labels = [0, 150, 200, 300, 400, 600, 800];
    labels.forEach(function (v) {
      var a = angleFor(v);
      var p1 = pt(a, G.r - 8, G.cx, G.cy), p2 = pt(a, G.r + 8, G.cx, G.cy), pl = pt(a, G.r + 16, G.cx, G.cy);
      if (v !== 0 && v !== G.max) {
        svg.appendChild(svgEl('line', { 'class': 'gauge-tick', x1: p1[0].toFixed(2), y1: p1[1].toFixed(2), x2: p2[0].toFixed(2), y2: p2[1].toFixed(2) }));
      }
      var t = svgEl('text', { 'class': 'gauge-label', x: pl[0].toFixed(2), y: (pl[1] + 3).toFixed(2) });
      t.textContent = String(v);
      svg.appendChild(t);
    });
    needle = svgEl('g', { 'class': 'gauge-needle' });
    needle.appendChild(svgEl('polygon', { points: '100,32 95.5,100 104.5,100' }));
    needle.appendChild(svgEl('circle', { cx: 100, cy: 100, r: 7 }));
    needle.style.transform = 'rotate(' + needleRotation(0) + 'deg)';
    svg.appendChild(needle);
  }

  function setNeedle(v) {
    var target = 'rotate(' + needleRotation(v).toFixed(2) + 'deg)';
    if (reduceMotion) { needle.style.transform = target; return; }
    /* Reset to zero without a transition, then let CSS animate the swing. */
    needle.style.transition = 'none';
    needle.style.transform = 'rotate(' + needleRotation(0) + 'deg)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        needle.style.transition = '';
        needle.style.transform = target;
      });
    });
  }

  /* ---------------------------------------------------------------------------
     Passage selection
     --------------------------------------------------------------------------- */
  function pickRandom(excludeId) {
    var pool = PASSAGES.filter(function (p) { return p.id !== excludeId; });
    if (!pool.length) pool = PASSAGES;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function nextPassage() {
    var i = PASSAGES.indexOf(passage);
    return PASSAGES[(i + 1) % PASSAGES.length];
  }

  function setPassage(p) {
    passage = p;
    els.title.textContent = p.title;
    els.words.textContent = String(E.wordCount(p.text));
    els.body.textContent = '';
  }

  /* ---------------------------------------------------------------------------
     Flow
     --------------------------------------------------------------------------- */
  function showIdle() {
    state = 'idle';
    elapsedMs = 0;
    els.body.hidden = true; els.body.textContent = '';
    els.veil.hidden = false;
    els.readingNote.hidden = true;
    els.controls.hidden = !!challenge;
    els.primary.hidden = false;
    els.primary.textContent = challenge ? 'Beat this score' : 'Start reading';
    els.hint.hidden = false;
    els.quiz.hidden = true;
    els.result.hidden = true;
    els.copyStatus.textContent = '';
  }

  function startReading() {
    if (state !== 'idle') return;
    state = 'reading';
    /* Inject the text now, as paragraphs, so it was never in the DOM before. */
    els.body.textContent = '';
    passage.text.trim().split(/\n\s*\n/).forEach(function (para) {
      var pEl = document.createElement('p');
      pEl.textContent = para.trim();
      els.body.appendChild(pEl);
    });
    els.veil.hidden = true;
    els.body.hidden = false;
    els.readingNote.hidden = false;
    els.controls.hidden = true;
    els.hint.hidden = true;
    els.primary.textContent = 'I’m done reading';
    startedAt = performance.now();
  }

  function doneReading() {
    if (state !== 'reading') return;
    elapsedMs = performance.now() - startedAt;
    state = 'quiz';
    els.body.hidden = true; els.body.textContent = '';
    els.veil.hidden = false;
    els.readingNote.hidden = true;
    els.primary.hidden = true;
    buildQuiz();
    els.quiz.hidden = false;
    els.quizHeading.focus();
  }

  function buildQuiz() {
    els.questions.textContent = '';
    passage.questions.forEach(function (q, qi) {
      var fs = document.createElement('fieldset');
      var lg = document.createElement('legend');
      var num = document.createElement('span');
      num.className = 'q-num'; num.textContent = (qi + 1) + '.';
      lg.appendChild(num);
      lg.appendChild(document.createTextNode(q.q));
      fs.appendChild(lg);
      q.options.forEach(function (opt, oi) {
        var label = document.createElement('label');
        label.className = 'choice';
        var input = document.createElement('input');
        input.type = 'radio'; input.name = 'q' + qi; input.value = String(oi);
        label.appendChild(input);
        label.appendChild(document.createTextNode(opt));
        fs.appendChild(label);
      });
      els.questions.appendChild(fs);
    });
    updateQuizProgress();
  }

  function answeredCount() {
    var n = 0;
    for (var i = 0; i < passage.questions.length; i++) {
      if (els.quizForm.querySelector('input[name="q' + i + '"]:checked')) n++;
    }
    return n;
  }
  function updateQuizProgress() {
    var n = answeredCount(), total = passage.questions.length;
    els.progress.textContent = n + ' of ' + total + ' answered';
    els.showResult.disabled = n < total;
  }

  function scoreQuiz() {
    var correct = 0;
    passage.questions.forEach(function (q, i) {
      var picked = els.quizForm.querySelector('input[name="q' + i + '"]:checked');
      if (picked && parseInt(picked.value, 10) === q.answer) correct++;
    });
    return correct;
  }

  function showResult() {
    if (state !== 'quiz' || answeredCount() < passage.questions.length) return;
    state = 'result';
    var words = E.wordCount(passage.text);
    var correct = scoreQuiz();
    var total = passage.questions.length;
    var speed = E.wpm(words, elapsedMs);
    var plausible = E.isPlausible(elapsedMs, speed);

    els.quiz.hidden = true;
    els.result.hidden = false;

    /* Under five seconds is not a read; refuse the number rather than flag it. */
    if (!plausible.ok && plausible.reason === 'too-fast') {
      els.resultBody.hidden = true;
      els.invalid.hidden = false;
      els.invalidText.textContent = plausible.message;
      els.resultHeading.focus();
      return;
    }
    els.invalid.hidden = true;
    els.resultBody.hidden = false;

    var effective = E.effectiveWpm(speed, correct, total);
    var b = E.band(speed);
    var vs = E.vsAverage(speed);
    var pct = Math.round(correct / total * 100);
    var url = baseUrl() + E.encodeShare({ p: passage.id, wpm: Math.min(speed, 5000), c: correct });
    lastResult = { wpm: speed, correct: correct, total: total, pct: pct, effective: effective, band: b, vs: vs, url: url };

    els.rWpm.textContent = String(speed);
    els.rBand.textContent = b.label;
    els.rBandNote.textContent = b.note;
    els.rComp.textContent = correct + '/' + total + ' · ' + pct + '%';
    els.rEff.textContent = String(effective);
    els.rVs.textContent = (vs > 0 ? '+' : vs < 0 ? '−' : '') + Math.abs(vs) + '% ' +
      (vs > 0 ? 'faster' : vs < 0 ? 'slower' : 'same as average');
    setNeedle(speed);

    /* Challenge outcome: compare raw wpm with the score in the link. */
    if (challenge && challenge.wpm != null) {
      els.rOutcome.hidden = false;
      els.rOutcome.classList.toggle('win', speed > challenge.wpm);
      if (speed > challenge.wpm) {
        els.rOutcome.textContent = 'You beat it: ' + speed + ' wpm against their ' + challenge.wpm + '. Share yours back.';
      } else if (speed < challenge.wpm) {
        els.rOutcome.textContent = 'They beat you: ' + challenge.wpm + ' wpm against your ' + speed + '. One more try?';
      } else {
        els.rOutcome.textContent = 'A dead heat: ' + speed + ' wpm each. Comprehension decides it.';
      }
    } else {
      els.rOutcome.hidden = true;
    }

    /* Flags we show alongside the number. */
    var flags = [];
    if (!plausible.ok && plausible.reason === 'skimming') flags.push(plausible.message);
    if (correct <= 2) flags.push('Low comprehension: try a slightly slower pass.');
    els.rFlags.textContent = '';
    flags.forEach(function (f) {
      var li = document.createElement('li'); li.textContent = f; els.rFlags.appendChild(li);
    });
    els.rFlags.hidden = !flags.length;

    /* Fun equivalents at this speed. */
    els.rEquiv.textContent = '';
    E.EQUIVALENTS.forEach(function (eq) {
      var t = E.timeToRead(eq.words, speed);
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.textContent = eq.label + ' (' + eq.words.toLocaleString('en-US') + ' words)';
      var bEl = document.createElement('b');
      bEl.textContent = (t.hours ? t.hours + ' h ' : '') + t.minutes + ' min';
      li.appendChild(span); li.appendChild(bEl);
      els.rEquiv.appendChild(li);
    });

    updatePersonalBest(speed, correct);

    /* Make the address bar itself the share link. */
    try { history.replaceState(null, '', E.encodeShare({ p: passage.id, wpm: Math.min(speed, 5000), c: correct })); } catch (e) { /* file:// or sandboxed */ }

    els.copyStatus.textContent = '';
    els.resultHeading.focus();
  }

  /* ---------------------------------------------------------------------------
     Personal best — optional, storage may be absent or blocked.
     --------------------------------------------------------------------------- */
  var BEST_KEY = 'rst-best';
  function updatePersonalBest(speed, correct) {
    els.rBest.hidden = true;
    try {
      var prev = JSON.parse(localStorage.getItem(BEST_KEY) || 'null');
      if (prev && typeof prev.wpm === 'number') {
        if (speed > prev.wpm) {
          els.rBest.textContent = 'New personal best on this device (previous: ' + prev.wpm + ' wpm).';
        } else {
          els.rBest.textContent = 'Your best on this device: ' + prev.wpm + ' wpm with ' + prev.c + '/5.';
        }
        els.rBest.hidden = false;
      }
      if (!prev || speed > prev.wpm) {
        localStorage.setItem(BEST_KEY, JSON.stringify({ wpm: speed, c: correct, p: passage.id }));
      }
    } catch (e) { /* storage disabled: the flow does not care */ }
  }

  /* ---------------------------------------------------------------------------
     Share, copy, download
     --------------------------------------------------------------------------- */
  function shareText(withUrl) {
    var r = lastResult;
    var s = 'I read at ' + r.wpm + ' words per minute with ' + r.pct + '% comprehension. Beat my score:';
    return withUrl ? s + ' ' + r.url : s;
  }

  function setStatus(msg) {
    els.copyStatus.textContent = msg;
    if (msg) setTimeout(function () { if (els.copyStatus.textContent === msg) els.copyStatus.textContent = ''; }, 4000);
  }

  function copyText(text) {
    var done = function () { setStatus('Link copied. Paste it anywhere.'); };
    var fallback = function () {
      /* Textarea fallback for browsers without the async clipboard API. */
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done(); else setStatus('Could not copy automatically. Your address bar holds the link.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function share() {
    if (!lastResult) return;
    if (navigator.share) {
      navigator.share({ title: 'Reading Speed Test', text: shareText(false), url: lastResult.url })
        .then(function () { setStatus('Shared.'); }, function (err) {
          if (!err || err.name !== 'AbortError') copyText(shareText(true));
        });
    } else {
      copyText(shareText(true));
    }
  }

  /* Result card: 1200x630 PNG drawn with system fonts only. */
  function drawCard() {
    var r = lastResult;
    var W = 1200, H = 630;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var serif = '"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif';
    var sans = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';

    ctx.fillStyle = '#faf6ee'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1f3d2b'; ctx.fillRect(0, 0, 22, H);            /* spine */
    ctx.fillStyle = '#e07a2f';                                        /* ribbon */
    ctx.beginPath(); ctx.moveTo(1090, 0); ctx.lineTo(1150, 0); ctx.lineTo(1150, 120); ctx.lineTo(1120, 96); ctx.lineTo(1090, 120); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#1f3d2b';
    ctx.font = '700 34px ' + serif;
    ctx.fillText('Reading Speed Test', 70, 86);
    ctx.fillStyle = '#5c6660';
    ctx.font = '400 26px ' + sans;
    ctx.fillText('Passage: ' + fit(ctx, passage.title, 620), 70, 130);

    ctx.fillStyle = '#1f3d2b';
    ctx.font = '700 200px ' + serif;
    ctx.fillText(String(r.wpm), 60, 345);
    var numW = ctx.measureText(String(r.wpm)).width;
    ctx.fillStyle = '#5c6660';
    ctx.font = '600 30px ' + sans;
    ctx.fillText('WORDS PER MINUTE', 70 + numW + 20, 338);

    ctx.fillStyle = '#1f3d2b';
    ctx.font = '700 44px ' + serif;
    ctx.fillText(r.band.label, 70, 420);
    ctx.fillStyle = '#5c6660';
    ctx.font = '400 30px ' + sans;
    ctx.fillText('Comprehension ' + r.correct + '/' + r.total + ' (' + r.pct + '%)  ·  Effective ' + r.effective + ' wpm', 70, 468);
    ctx.fillText((r.vs > 0 ? '+' : r.vs < 0 ? '−' : '') + Math.abs(r.vs) + '% vs the average adult (238 wpm)', 70, 510);

    ctx.fillStyle = '#e07a2f';
    ctx.font = '600 28px ' + sans;
    ctx.fillText('Beat my score: ' + r.url.replace(/^https?:\/\//, ''), 70, 578);

    /* Mini gauge, same geometry as the SVG. Canvas angles are clockwise, so negate. */
    var cx = 985, cy = 420, rad = 150, rd = Math.PI / 180;
    ctx.lineCap = 'round';
    ctx.lineWidth = 26; ctx.strokeStyle = '#e4ebe2';
    ctx.beginPath(); ctx.arc(cx, cy, rad, -angleFor(0) * rd, -angleFor(G.max) * rd, false); ctx.stroke();
    ctx.lineCap = 'butt';
    var stops = E.BANDS.map(function (b) { return b.min; }).concat([G.max]);
    for (var i = 0; i < stops.length - 1; i++) {
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(31,61,43,.32)' : 'rgba(31,61,43,.55)';
      ctx.beginPath(); ctx.arc(cx, cy, rad, -angleFor(stops[i]) * rd, -angleFor(stops[i + 1]) * rd, false); ctx.stroke();
    }
    var na = angleFor(r.wpm) * rd;
    ctx.strokeStyle = '#e07a2f'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (rad - 20) * Math.cos(na), cy - (rad - 20) * Math.sin(na)); ctx.stroke();
    ctx.fillStyle = '#faf6ee'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e07a2f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#5c6660'; ctx.font = '400 22px ' + sans; ctx.textAlign = 'center';
    [0, 200, 400, 600, 800].forEach(function (v) {
      var a = angleFor(v) * rd;
      ctx.fillText(String(v), cx + (rad + 34) * Math.cos(a), cy - (rad + 34) * Math.sin(a) + 8);
    });
    ctx.textAlign = 'left';
    return canvas;
  }
  function fit(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 3 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  function download() {
    if (!lastResult) return;
    var canvas = drawCard();
    if (!canvas) { setStatus('Your browser could not draw the card.'); return; }
    var name = 'reading-speed-' + lastResult.wpm + 'wpm.png';
    var save = function (href, revoke) {
      var a = document.createElement('a');
      a.href = href; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 2000);
      setStatus('Result card downloaded.');
    };
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) save(URL.createObjectURL(blob), true); else save(canvas.toDataURL('image/png'), false);
      }, 'image/png');
    } else {
      save(canvas.toDataURL('image/png'), false);
    }
  }

  /* ---------------------------------------------------------------------------
     Events
     --------------------------------------------------------------------------- */
  els.primary.addEventListener('click', function () {
    if (state === 'idle') startReading(); else if (state === 'reading') doneReading();
  });

  /* Space/Enter finishes the read — only while reading, and never when the key
     would already mean something to a focused control. */
  document.addEventListener('keydown', function (ev) {
    if (state !== 'reading') return;
    if (ev.key !== ' ' && ev.key !== 'Enter' && ev.key !== 'Spacebar') return;
    var t = ev.target;
    var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    if (/^(input|button|select|textarea|a|summary)$/.test(tag) || (t && t.isContentEditable)) return;
    ev.preventDefault();
    doneReading();
  });

  els.change.addEventListener('click', function () {
    if (state !== 'idle' || challenge) return;
    setPassage(nextPassage());
    try { history.replaceState(null, '', '?p=' + encodeURIComponent(passage.id)); } catch (e) { /* ignore */ }
  });

  els.quizForm.addEventListener('change', updateQuizProgress);
  els.quizForm.addEventListener('submit', function (ev) { ev.preventDefault(); showResult(); });

  els.share.addEventListener('click', share);
  els.copy.addEventListener('click', function () { if (lastResult) copyText(lastResult.url); });
  els.download.addEventListener('click', download);

  function resetTo(p, keepChallenge) {
    if (!keepChallenge) {
      challenge = null;
      els.challenge.hidden = true;
    }
    setPassage(p);
    showIdle();
    /* Keep the challenge link intact so a reload still shows the banner. */
    var q = challenge ? E.encodeShare(challenge) : '?p=' + encodeURIComponent(p.id);
    try { history.replaceState(null, '', q); } catch (e) { /* ignore */ }
    els.primary.focus();
  }
  els.another.addEventListener('click', function () { resetTo(pickRandom(passage.id), false); });
  els.again.addEventListener('click', function () { resetTo(passage, true); });
  els.invalidRetry.addEventListener('click', function () { resetTo(passage, true); });

  /* ---------------------------------------------------------------------------
     Boot: challenge link > plain ?p= link > random. Never auto-scroll.
     --------------------------------------------------------------------------- */
  buildGauge();
  var decoded = E.decodeShare(location.search, ids);
  if (!decoded) {
    /* Garbage challenge params still honour a valid ?p= as a plain passage pick. */
    var m = /[?&]p=([^&#]*)/.exec(location.search);
    if (m) decoded = E.decodeShare('?p=' + m[1], ids);
  }
  var initial = decoded ? byId(decoded.p) : null;
  if (decoded && decoded.wpm != null && initial) {
    challenge = decoded;
    els.challengeText.textContent = '';
    els.challengeText.appendChild(document.createTextNode('Someone read this passage at '));
    var strong = document.createElement('strong');
    strong.textContent = challenge.wpm + ' wpm';
    els.challengeText.appendChild(strong);
    els.challengeText.appendChild(document.createTextNode(' with ' + challenge.c + '/5 comprehension. Can you beat it?'));
    els.challenge.hidden = false;
  }
  setPassage(initial || pickRandom(null));
  showIdle();
})();
