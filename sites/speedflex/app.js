/* SpeedFlex UI. Talks to window.SpeedEngine (engine.js). No external requests of its own. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var HISTORY_KEY = 'speedflex:history:v1';
  var NAME_KEY = 'speedflex:name';
  var PLAN_KEY = 'speedflex:plan';

  /* ---------- Persona tiers (by download Mbps) ---------- */
  var TIERS = [
    { min: 0, label: '<5', name: 'Dial-up Dinosaur', tag: 'Pages load. Eventually. Emails are your love language.' },
    { min: 5, label: '5+', name: 'Buffering Barnacle', tag: 'HD with patience. The spinning circle knows you by name.' },
    { min: 25, label: '25+', name: 'Streaming Squire', tag: 'One 4K stream, a call and a playlist without drama.' },
    { min: 100, label: '100+', name: 'Bandwidth Bandit', tag: 'A whole household streaming at once. Nobody complains.' },
    { min: 300, label: '300+', name: 'Packet Rocket', tag: 'Game updates done before the kettle boils.' },
    { min: 600, label: '600+', name: 'Warp Wrangler', tag: 'You download faster than most people decide what to watch.' },
    { min: 1000, label: '1G+', name: 'Fiber Overlord', tag: 'Gigabit club. Bow before your router.' }
  ];
  function tierIndex(mbps) {
    var i = 0;
    for (var k = 0; k < TIERS.length; k++) if (mbps >= TIERS[k].min) i = k;
    return i;
  }

  /* ---------- Formatting ---------- */
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function fmtMbps(v) {
    if (!num(v)) return '—';
    if (v >= 100) return String(Math.round(v));
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }
  function fmtMs(v) { return num(v) ? String(Math.round(v)) : '—'; }
  function fmtDuration(sec) {
    if (!num(sec) || sec <= 0) return '—';
    if (sec < 60) return Math.max(1, Math.round(sec)) + ' sec';
    if (sec < 3600) return Math.round(sec / 60) + ' min';
    if (sec < 86400) {
      var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
      if (m === 60) { h++; m = 0; }
      return h + ' h' + (m ? ' ' + m + ' min' : '');
    }
    var d = Math.floor(sec / 86400), hh = Math.round((sec % 86400) / 3600);
    if (hh === 24) { d++; hh = 0; }
    return d + (d === 1 ? ' day' : ' days') + (hh ? ' ' + hh + ' h' : '');
  }
  function fmtDate(ms) {
    try { return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return new Date(ms).toDateString(); }
  }
  function fmtDateTime(ms) {
    try { return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return new Date(ms).toString(); }
  }
  function sanitizeName(s) {
    if (typeof s !== 'string') return '';
    var out;
    try { out = s.replace(/[^\p{L}\p{M}\p{N} .'\-]/gu, ''); }
    catch (e) { out = s.replace(/[^A-Za-z0-9À-ɏ .'\-]/g, ''); }
    return out.replace(/\s+/g, ' ').trim().slice(0, 20).trim();
  }

  /* ---------- Safe storage (convenience only) ---------- */
  function store(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ } }
  function load(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function drop(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  /* ---------- Live region ---------- */
  var liveTimer;
  function announce(text) {
    var el = $('live');
    el.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { el.textContent = text; }, 60);
  }

  /* ---------- Gauge ---------- */
  var CX = 160, CY = 160, R = 120, SWEEP = 240;
  var MARKS = [0, 1, 5, 10, 50, 100, 250, 500, 1000];
  function frac(mbps) {
    if (!num(mbps) || mbps <= 0) return 0;
    return Math.min(1, Math.log10(1 + mbps) / Math.log10(1001));
  }
  function pt(f, r) {
    var a = (-SWEEP / 2 + SWEEP * f) * Math.PI / 180;
    return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
  }
  function arcPath(r) {
    var s = pt(0, r), e = pt(1, r);
    return 'M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 1 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2);
  }
  function buildGauge() {
    $('g-track').setAttribute('d', arcPath(R));
    $('g-fill').setAttribute('d', arcPath(R));
    var g = $('g-ticks'), ns = 'http://www.w3.org/2000/svg';
    MARKS.forEach(function (m) {
      var f = frac(m), a = pt(f, R - 18), b = pt(f, R - 28), t = pt(f, R + 26);
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', a[0]); line.setAttribute('y1', a[1]);
      line.setAttribute('x2', b[0]); line.setAttribute('y2', b[1]);
      g.appendChild(line);
      var text = document.createElementNS(ns, 'text');
      text.setAttribute('x', t[0].toFixed(1)); text.setAttribute('y', t[1].toFixed(1));
      text.textContent = m === 1000 ? '1G' : String(m);
      g.appendChild(text);
    });
  }
  var gaugeTarget = 0, gaugeShown = 0, gaugeRaf = 0;
  function paintGauge(f) {
    var fill = $('g-fill');
    fill.setAttribute('stroke-dasharray', (f * 1000).toFixed(1) + ' 1000');
    fill.style.opacity = f > 0.002 ? '1' : '0';
    $('g-needle').setAttribute('transform', 'rotate(' + (-SWEEP / 2 + SWEEP * f).toFixed(2) + ' ' + CX + ' ' + CY + ')');
  }
  function setGauge(mbps) {
    gaugeTarget = frac(mbps);
    if (reduceMotion) { gaugeShown = gaugeTarget; paintGauge(gaugeShown); return; }
    if (!gaugeRaf) gaugeRaf = requestAnimationFrame(tick);
  }
  function tick() {
    var diff = gaugeTarget - gaugeShown;
    gaugeShown = Math.abs(diff) < 0.001 ? gaugeTarget : gaugeShown + diff * 0.14;
    paintGauge(gaugeShown);
    gaugeRaf = gaugeShown === gaugeTarget ? 0 : requestAnimationFrame(tick);
  }

  /* ---------- Test state ---------- */
  var PHASE_LABEL = { idle: 'Ready', meta: 'Connecting', latency: 'Ping', download: 'Download', upload: 'Upload', done: 'Done', stopped: 'Stopped', error: 'Error' };
  var PHASE_SAY = { meta: 'Connecting to the test server.', latency: 'Measuring ping.', download: 'Measuring download speed.', upload: 'Measuring upload speed.' };
  var runId = 0, controller = null, running = false, lastResult = null, challenge = null;

  var curPhase = 'idle';
  function setPhase(phase) {
    curPhase = phase;
    $('dial').setAttribute('data-phase', phase);
    $('phase-label').textContent = PHASE_LABEL[phase] || phase;
    var steps = document.querySelectorAll('#steps li');
    var order = ['latency', 'download', 'upload'];
    var idx = order.indexOf(phase);
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i].getAttribute('data-step');
      steps[i].classList.toggle('is-active', s === phase);
      if (idx > order.indexOf(s) || phase === 'done') $('sb-' + s).style.width = '100%';
    }
    if (phase === 'latency' || phase === 'meta') { $('big-unit').textContent = 'ms'; setBig(null); setGauge(0); }
    if (phase === 'download' || phase === 'upload') { $('big-unit').textContent = 'Mbps'; setBig(null); setGauge(0); }
    if (PHASE_SAY[phase]) announce(PHASE_SAY[phase]);
  }
  function setBig(text) { $('big-num').textContent = text == null ? '0' : text; }

  function onProgress(p) {
    if (!p || !p.phase || p.phase !== curPhase) return;
    var bar = $('sb-' + p.phase);
    if (bar && num(p.progress)) bar.style.width = Math.max(0, Math.min(1, p.progress)) * 100 + '%';
    if (p.phase === 'latency' && num(p.latencyMs)) {
      setBig(fmtMs(p.latencyMs));
      $('sv-latency').textContent = fmtMs(p.latencyMs) + ' ms';
    }
    if ((p.phase === 'download' || p.phase === 'upload') && num(p.mbps)) {
      setBig(fmtMbps(p.mbps));
      setGauge(p.mbps);
      $('sv-' + p.phase).textContent = fmtMbps(p.mbps) + ' Mbps';
    }
  }

  function setRunningUI(on) {
    var again = $('btn-again'), stop = $('btn-stop');
    var hadFocus = document.activeElement === stop || document.activeElement === again;
    stop.hidden = !on;
    again.hidden = on;
    again.textContent = 'Test again';
    if (hadFocus) (on ? stop : again).focus();
  }

  function resetUI() {
    ['latency', 'download', 'upload'].forEach(function (s) {
      $('sv-' + s).textContent = '—';
      $('sb-' + s).style.width = '0';
    });
    $('err').hidden = true;
    setBig(null);
    setGauge(0);
  }

  function resolveBase() {
    try {
      var h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') {
        var e = new URLSearchParams(location.search).get('endpoint');
        if (e) {
          var u = new URL(e);
          if (u.protocol === 'http:' || u.protocol === 'https:') return u.href.replace(/\/+$/, '');
        }
      }
    } catch (err) { /* ignore */ }
    return undefined;
  }

  function startTest() {
    if (running) return;
    var engine = window.SpeedEngine;
    if (!engine || typeof engine.run !== 'function') {
      showError('The speed test engine did not load. Reload the page and try again.');
      return;
    }
    var myRun = ++runId;
    running = true;
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    resetUI();
    setRunningUI(true);
    setPhase('meta');
    var opts = {
      onPhase: function (ph) { if (myRun === runId && ph !== 'done') setPhase(ph); },
      onProgress: function (p) { if (myRun === runId) onProgress(p); }
    };
    if (controller) opts.signal = controller.signal;
    var base = resolveBase();
    if (base) opts.base = base;
    var p;
    try { p = engine.run(opts); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(function (res) {
      if (myRun !== runId) return;
      running = false;
      setRunningUI(false);
      finish(res || {});
    }, function (err) {
      if (myRun !== runId) return;
      running = false;
      setRunningUI(false);
      if (err && err.name === 'AbortError') { markStopped(); return; }
      showError('The test could not reach the server. Check your connection and select “Test again”.');
    });
  }

  function stopTest() {
    if (!running) return;
    runId++;
    running = false;
    try { if (controller) controller.abort(); } catch (e) { /* ignore */ }
    setRunningUI(false);
    markStopped();
  }
  function markStopped() {
    setPhase('stopped');
    setGauge(0);
    setBig(null);
    $('steps').querySelectorAll('li').forEach(function (li) { li.classList.remove('is-active'); });
    announce('Test stopped. Select Test again to restart.');
  }
  function showError(msg) {
    setPhase('error');
    var e = $('err');
    e.textContent = msg;
    e.hidden = false;
  }

  /* ---------- Results ---------- */
  function finish(res) {
    var d = num(res.downloadMbps) ? res.downloadMbps : null;
    var u = num(res.uploadMbps) ? res.uploadMbps : null;
    var r = {
      d: d, u: u,
      p: num(res.idleLatencyMs) ? res.idleLatencyMs : null,
      j: num(res.jitterMs) ? res.jitterMs : null,
      ld: num(res.loadedLatencyDownMs) ? res.loadedLatencyDownMs : null,
      lu: num(res.loadedLatencyUpMs) ? res.loadedLatencyUpMs : null,
      bd: num(res.bufferbloatDeltaMs) ? res.bufferbloatDeltaMs : null,
      g: typeof res.bufferbloatGrade === 'string' ? res.bufferbloatGrade.slice(0, 2) : null,
      meta: res.meta && typeof res.meta === 'object' ? res.meta : null,
      bytes: num(res.bytesUsed) ? res.bytesUsed : null,
      t: num(res.startedAt) ? res.startedAt : Date.now()
    };
    lastResult = r;
    setPhase('done');
    $('steps').querySelectorAll('li').forEach(function (li) { li.classList.remove('is-active'); });
    $('big-unit').textContent = 'Mbps download';
    setBig(fmtMbps(d));
    setGauge(d || 0);
    $('sv-latency').textContent = r.p == null ? '—' : fmtMs(r.p) + ' ms';
    $('sv-download').textContent = d == null ? 'Failed' : fmtMbps(d) + ' Mbps';
    $('sv-upload').textContent = u == null ? 'Failed' : fmtMbps(u) + ' Mbps';
    if (r.bytes) $('data-note').textContent = 'This test used about ' + Math.max(1, Math.round(r.bytes / 1e6)) + ' MB of data.';

    renderResults(r);
    renderCanDo(r);
    renderPlan();
    renderVersus();
    saveHistory(r);
    renderHistory();
    enableShare();

    var say = 'Test complete. Download ' + (d == null ? 'failed' : fmtMbps(d) + ' megabits per second') +
      ', upload ' + (u == null ? 'failed' : fmtMbps(u) + ' megabits per second') +
      ', ping ' + (r.p == null ? 'unknown' : fmtMs(r.p) + ' milliseconds') +
      (r.g ? ', bufferbloat grade ' + r.g : '') + '.';
    if (d != null) say += ' You are a ' + TIERS[tierIndex(d)].name + '.';
    announce(say);
  }

  function renderLadder(active) {
    var ol = $('ladder');
    ol.textContent = '';
    TIERS.forEach(function (t, i) {
      var li = document.createElement('li');
      if (active === i) { li.className = 'is-you'; li.setAttribute('aria-current', 'true'); }
      else if (active != null && i < active) li.className = 'is-below';
      var lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.setAttribute('aria-hidden', 'true');
      lbl.textContent = t.label;
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      var next = TIERS[i + 1];
      sr.textContent = t.name + ': ' + (next ? (t.min ? t.min + ' to ' + next.min : 'under ' + next.min) : t.min + ' and up') + ' Mbps' + (active === i ? ' (you)' : '');
      li.title = t.name;
      li.appendChild(lbl);
      li.appendChild(sr);
      ol.appendChild(li);
    });
  }

  function renderResults(r) {
    var card = $('results');
    card.setAttribute('data-state', 'done');
    if (r.d != null) {
      var t = TIERS[tierIndex(r.d)];
      $('persona-name').textContent = t.name;
      $('persona-tag').textContent = t.tag;
      renderLadder(tierIndex(r.d));
    } else {
      $('persona-name').textContent = 'Mystery Connection';
      $('persona-tag').textContent = 'The download test failed, so your persona is classified. Try again.';
      renderLadder(null);
    }
    $('r-down').textContent = r.d == null ? 'Failed' : fmtMbps(r.d);
    $('r-up').textContent = r.u == null ? 'Failed' : fmtMbps(r.u);
    $('r-ping').textContent = fmtMs(r.p);
    $('r-jitter').textContent = r.j == null ? '—' : (r.j < 10 ? r.j.toFixed(1) : fmtMs(r.j));
    var loaded = [r.ld, r.lu].filter(num);
    $('r-loaded').textContent = loaded.length ? fmtMs(Math.max.apply(null, loaded)) : '—';
    var g = $('r-grade');
    g.textContent = r.g || '–';
    g.setAttribute('data-g', r.g || '');
    g.setAttribute('aria-label', r.g ? 'Grade ' + r.g : 'No grade');
    $('r-delta').textContent = r.bd == null ? '' : '+' + fmtMs(r.bd) + ' ms under load';
    var m = r.meta, bits = [];
    if (m) {
      if (m.isp) bits.push(String(m.isp));
      var place = [m.city, m.country].filter(Boolean).map(String).join(', ');
      if (place) bits.push(place);
      if (m.colo) bits.push('Test server: ' + String(m.colo));
    }
    $('r-meta').textContent = bits.length ? bits.join(' · ') : 'Provider and location unavailable for this test.';
  }

  /* ---------- What your connection can do ---------- */
  var GRADE_RANK = { 'A+': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5 };
  function gamingVerdict(p, j, g) {
    if (p == null) return ['—', 'Ping test did not complete'];
    var jj = j == null ? 0 : j, rank = g && g in GRADE_RANK ? GRADE_RANK[g] : 2;
    if (p <= 20 && jj <= 5 && rank <= 1) return ['Pro-ready', 'Competitive play, zero excuses'];
    if (p <= 40 && jj <= 10 && rank <= 2) return ['Great', 'Smooth for online shooters'];
    if (p <= 80 && jj <= 20 && rank <= 3) return ['Playable', 'Fine for casual and co-op games'];
    return ['Laggy', 'Expect lag spikes in fast games'];
  }
  function renderCanDo(r) {
    if (r.d != null) {
      var s = Math.floor(r.d / 25);
      $('c-4k').textContent = String(s);
      $('c-4k-n').textContent = s ? '25 Mbps each' : 'Needs 25 Mbps; HD needs about 5';
      $('c-50').textContent = fmtDuration(50e9 * 8 / (r.d * 1e6));
      $('c-20').textContent = fmtDuration(20e9 * 8 / (r.d * 1e6));
    } else {
      $('c-4k').textContent = $('c-50').textContent = $('c-20').textContent = '—';
    }
    var lim = [r.d, r.u].filter(num);
    if (lim.length) {
      var c = Math.floor(Math.min.apply(null, lim) / 3.8);
      $('c-calls').textContent = String(c);
      $('c-calls-n').textContent = (r.u != null && r.d != null && r.u < r.d) ? 'Limited by your upload (≈3.8 Mbps each)' : '≈3.8 Mbps up and down per call';
    } else $('c-calls').textContent = '—';
    var v = gamingVerdict(r.p, r.j, r.g);
    $('c-game').textContent = v[0];
    $('c-game-n').textContent = v[1];
  }

  /* ---------- Plan check ---------- */
  function renderPlan() {
    var raw = $('plan-in').value, plan = parseFloat(raw), out = $('plan-out');
    if (!raw || !(plan > 0) || plan > 100000) { out.hidden = true; return; }
    store(PLAN_KEY, String(plan));
    if (!lastResult || lastResult.d == null) {
      out.hidden = false;
      $('plan-pct').textContent = '…';
      $('plan-pct-t').textContent = 'run a test to compare';
      $('plan-bar').style.width = '0';
      $('complaint').hidden = true;
      return;
    }
    var pct = lastResult.d / plan * 100, shown = Math.round(pct);
    out.hidden = false;
    $('plan-pct').textContent = shown + '%';
    $('plan-pct-t').textContent = 'of your ' + fmtMbps(plan) + ' Mbps plan delivered';
    $('plan-bar').style.width = Math.min(100, pct) + '%';
    var meter = $('plan-meter');
    meter.setAttribute('data-level', pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low');
    meter.setAttribute('aria-label', shown + ' percent of plan delivered');
    var bad = pct < 80;
    $('complaint').hidden = !bad;
    if (bad) $('complaint-text').value = complaintText(plan, shown);
  }
  function complaintText(plan, pct) {
    var r = lastResult, name = sanitizeName($('name-in').value);
    return 'Hello,\n\n' +
      'My plan includes download speeds of ' + fmtMbps(plan) + ' Mbps, but a speed test on ' + fmtDate(r.t) +
      ' measured ' + fmtMbps(r.d) + ' Mbps download (' + pct + '% of my plan)' +
      (r.u != null ? ', ' + fmtMbps(r.u) + ' Mbps upload' : '') +
      (r.p != null ? ' and ' + fmtMs(r.p) + ' ms ping' : '') + '.\n\n' +
      'Could you please check my line and equipment for faults and let me know what you can do to bring my speed closer to what I am paying for? ' +
      'If that is not possible, I would like to discuss a price adjustment or a plan that matches the speed I actually receive.\n\n' +
      'Thank you for your help.\n' + (name ? name + '\n' : '');
  }

  /* ---------- Challenge links ---------- */
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    if (!/^[A-Za-z0-9_-]{4,600}$/.test(s)) throw new Error('bad');
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var bin = atob(b), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  function round1(v) { return Math.round(v * 10) / 10; }
  function challengeLink() {
    var r = lastResult;
    if (!r || r.d == null) return null;
    var o = { d: round1(r.d), u: r.u == null ? null : round1(r.u), p: r.p == null ? null : Math.round(r.p) };
    var n = sanitizeName($('name-in').value);
    if (n) o.n = n;
    o.t = Math.floor(r.t / 1000);
    return location.origin + location.pathname + '#c=' + b64urlEncode(JSON.stringify(o));
  }
  function inRange(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi; }
  function parseChallenge(hash) {
    try {
      var m = /^#c=([A-Za-z0-9_-]+)$/.exec(hash || '');
      if (!m) return null;
      var o = JSON.parse(b64urlDecode(m[1]));
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      if (!inRange(o.d, 0.01, 100000)) return null;
      if (o.u != null && !inRange(o.u, 0, 100000)) return null;
      if (o.p != null && !inRange(o.p, 0, 60000)) return null;
      var nowS = Date.now() / 1000;
      if (!inRange(o.t, 1577836800, nowS + 86400) || Math.floor(o.t) !== o.t) return null;
      var n = o.n == null ? '' : (typeof o.n === 'string' ? sanitizeName(o.n) : null);
      if (n === null) return null;
      return { d: o.d, u: o.u == null ? null : o.u, p: o.p == null ? null : o.p, n: n, t: o.t * 1000 };
    } catch (e) { return null; }
  }
  function applyChallenge() {
    challenge = parseChallenge(location.hash);
    document.documentElement.classList.remove('has-c');
    var banner = $('challenge-banner'), vs = $('versus');
    if (!challenge) { banner.hidden = true; vs.hidden = true; return; }
    $('challenge-text').textContent = (challenge.n || 'A friend') + ' got ' + fmtMbps(challenge.d) + ' Mbps — can you beat it?';
    banner.hidden = false;
    vs.hidden = false;
    $('vs-them-h').textContent = challenge.n || 'Them';
    renderVersus();
  }
  function compare(you, them, higherBetter) {
    if (you == null || them == null) return { cls: '', text: '—', win: 0 };
    if (them === 0 && you === 0) return { cls: '', text: 'Tie', win: 0 };
    var diff = higherBetter ? (you - them) / (them || 1) : (them - you) / (them || 1);
    var pct = Math.round(Math.abs(diff) * 100);
    if (pct === 0) return { cls: '', text: 'Tie', win: 0 };
    return diff > 0 ? { cls: 'win', text: 'You win (+' + pct + '%)', win: 1 } : { cls: 'lose', text: 'They win (' + pct + '% ' + (higherBetter ? 'faster' : 'lower') + ')', win: -1 };
  }
  var lastVs = null;
  function renderVersus() {
    if (!challenge) return;
    var body = $('vs-body'), r = lastResult;
    body.textContent = '';
    var rows = [
      ['Download', r && r.d, challenge.d, true, ' Mbps', fmtMbps],
      ['Upload', r && r.u, challenge.u, true, ' Mbps', fmtMbps],
      ['Ping', r && r.p, challenge.p, false, ' ms', fmtMs]
    ];
    var score = 0, counted = 0, dlDiff = null;
    rows.forEach(function (row) {
      var you = num(row[1]) ? row[1] : null, them = num(row[2]) ? row[2] : null;
      var c = r ? compare(you, them, row[3]) : { cls: '', text: 'Waiting…', win: 0 };
      if (r && you != null && them != null) { score += c.win; counted++; }
      if (row[0] === 'Download' && r && you != null && them) dlDiff = Math.round((you - them) / them * 100);
      var tr = document.createElement('tr');
      [row[0], you == null ? '—' : row[5](you) + row[4], them == null ? '—' : row[5](them) + row[4], c.text].forEach(function (txt, i) {
        var cell = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) cell.scope = 'row';
        if (i === 3 && c.cls) cell.className = c.cls;
        cell.textContent = txt;
        tr.appendChild(cell);
      });
      body.appendChild(tr);
    });
    var who = challenge.n || 'your friend';
    var v = $('vs-verdict');
    if (!r) { v.textContent = 'Finish the test to see who wins.'; lastVs = null; return; }
    if (score > 0) v.textContent = 'You beat ' + who + '! Time to rub it in.';
    else if (score < 0) v.textContent = (challenge.n || 'Your friend') + ' wins this round. Rematch?';
    else v.textContent = counted ? 'Dead heat with ' + who + '.' : 'Not enough data to call it.';
    lastVs = { score: score, who: who, dl: dlDiff };
    $('btn-challenge-back').disabled = !(r && r.d != null);
  }

  /* ---------- Share card ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fitFont(ctx, text, maxW, size, weight) {
    var s = size;
    do { ctx.font = weight + ' ' + s + 'px ' + FONT; if (ctx.measureText(text).width <= maxW) break; s -= 4; } while (s > 18);
    return s;
  }
  function drawCard() {
    var r = lastResult;
    if (!r) return null;
    var c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    var ctx = c.getContext('2d');
    if (!ctx) return null;
    var W = 1080, VOLT = '#d4ff3a', LAV = '#b9a8ff', name = sanitizeName($('name-in').value);
    var bg = ctx.createLinearGradient(0, 0, W, 1350);
    bg.addColorStop(0, '#2a1170'); bg.addColorStop(0.55, '#150c3a'); bg.addColorStop(1, '#0c0a1a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 1350);
    var glow = ctx.createRadialGradient(900, 140, 10, 900, 140, 520);
    glow.addColorStop(0, 'rgba(212,255,58,0.22)'); glow.addColorStop(1, 'rgba(212,255,58,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 1350);

    // Wordmark
    rr(ctx, 80, 74, 64, 64, 18); ctx.fillStyle = '#5b21e6'; ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = VOLT; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(112, 120, 20, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(112, 120); ctx.lineTo(125, 103); ctx.stroke();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.font = '800 50px ' + FONT; ctx.fillText('Speed', 164, 124);
    var sw = ctx.measureText('Speed').width;
    ctx.fillStyle = VOLT; ctx.font = '900 50px ' + FONT; ctx.fillText('Flex', 164 + sw, 124);
    ctx.textAlign = 'right'; ctx.fillStyle = LAV; ctx.font = '600 32px ' + FONT;
    ctx.fillText(fmtDate(r.t), 1000, 120);

    ctx.textAlign = 'center'; ctx.fillStyle = LAV; ctx.font = '700 38px ' + FONT;
    var head = name ? name + '’s internet speed' : 'My internet speed';
    fitFont(ctx, head, 920, 38, 700); ctx.fillText(head, 540, 196);

    // Gauge arc
    var cx = 540, cy = 560, R2 = 300, a0 = -210 * Math.PI / 180, a1 = 30 * Math.PI / 180;
    ctx.lineWidth = 46; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, R2, a0, a1); ctx.stroke();
    var f = frac(r.d || 0);
    if (f > 0) {
      var ag = ctx.createLinearGradient(cx - R2, cy + R2, cx + R2, cy - R2);
      ag.addColorStop(0, '#7b4dff'); ag.addColorStop(0.7, '#c69bff'); ag.addColorStop(1, VOLT);
      ctx.strokeStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, R2, a0, a0 + (a1 - a0) * f); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    var big = r.d == null ? '—' : fmtMbps(r.d);
    fitFont(ctx, big, 520, 230, 900); ctx.fillText(big, cx, 620);
    ctx.fillStyle = LAV; ctx.font = '700 42px ' + FONT; ctx.fillText('Mbps download', cx, 700);

    // Persona
    var t = r.d == null ? null : TIERS[tierIndex(r.d)];
    ctx.fillStyle = VOLT;
    var pn = t ? t.name : 'Mystery Connection';
    fitFont(ctx, pn, 920, 80, 900); ctx.fillText(pn, cx, 850);
    ctx.fillStyle = '#e7e1ff';
    var tag = t ? t.tag : 'Download test failed.';
    fitFont(ctx, tag, 920, 32, 500); ctx.fillText(tag, cx, 905);

    // Stats row
    var stats = [['UPLOAD', r.u == null ? '—' : fmtMbps(r.u), 'Mbps'], ['PING', fmtMs(r.p), 'ms'], ['BUFFERBLOAT', r.g || '—', 'grade']];
    stats.forEach(function (s, i) {
      var x = 80 + i * 320, y = 960;
      rr(ctx, x, y, 280, 190, 28); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = LAV; ctx.font = '800 26px ' + FONT; ctx.fillText(s[0], x + 140, y + 50);
      ctx.fillStyle = i === 2 ? VOLT : '#fff'; fitFont(ctx, s[1], 240, 76, 900); ctx.fillText(s[1], x + 140, y + 135);
      ctx.fillStyle = LAV; ctx.font = '600 26px ' + FONT; ctx.fillText(s[2], x + 140, y + 172);
    });

    // CTA
    var cta = 'Think you’re faster? Beat me at speedflex.app';
    if (lastVs && lastVs.score > 0 && challenge) cta = 'I beat ' + (challenge.n || 'my friend') + '. Your turn: speedflex.app';
    rr(ctx, 80, 1196, 920, 100, 50); ctx.fillStyle = VOLT; ctx.fill();
    ctx.fillStyle = '#1d2400'; fitFont(ctx, cta, 860, 40, 800); ctx.fillText(cta, 540, 1260);
    return c;
  }
  function refreshPreview() {
    var c = drawCard(), img = $('card-preview');
    if (!c) return;
    try {
      img.src = c.toDataURL('image/png');
      img.alt = 'Share card preview: ' + fmtMbps(lastResult.d) + ' Mbps download, ' + (lastResult.d == null ? '' : TIERS[tierIndex(lastResult.d)].name);
    } catch (e) { /* ignore */ }
  }
  function cardBlob() {
    return new Promise(function (resolve) {
      var c = drawCard();
      if (!c || !c.toBlob) return resolve(null);
      c.toBlob(function (b) { resolve(b); }, 'image/png');
    });
  }
  function status(msg) { $('share-status').textContent = msg; }
  function shareText() {
    var r = lastResult, link = challengeLink();
    return 'I got ' + fmtMbps(r.d) + ' Mbps down on SpeedFlex' + (r.d != null ? ' (' + TIERS[tierIndex(r.d)].name + ')' : '') + '. Can you beat it? ' + (link || '');
  }
  function shareResult() {
    if (!lastResult) return;
    cardBlob().then(function (blob) {
      if (!blob) { status('Could not create the share card in this browser.'); return; }
      var fname = 'speedflex-' + (lastResult.d == null ? 'result' : Math.round(lastResult.d) + 'mbps') + '.png';
      var file = null;
      try { file = new File([blob], fname, { type: 'image/png' }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.share) {
        var ok = false;
        try { ok = navigator.canShare({ files: [file] }); } catch (e) { ok = false; }
        if (ok) {
          navigator.share({ files: [file], title: 'My SpeedFlex result', text: shareText() }).then(function () {
            status('Shared. Now wait for the replies.');
          }, function (err) {
            if (!err || err.name !== 'AbortError') downloadBlob(blob, fname);
          });
          return;
        }
      }
      downloadBlob(blob, fname);
    });
  }
  function downloadBlob(blob, fname) {
    try {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = fname; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      status('Saved ' + fname + '. Post it anywhere.');
    } catch (e) { status('Could not save the image in this browser.'); }
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea'), active = document.activeElement, ok = false;
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    if (active && active.focus) active.focus();
    return ok;
  }
  function copyLink() {
    var link = challengeLink();
    if (!link) return;
    copyText(link).then(function (ok) {
      status(ok ? 'Challenge link copied. Send it to someone who brags about their Wi-Fi.' : 'Copy this link: ' + link);
    });
  }
  function challengeBack() {
    var link = challengeLink();
    if (!link) return;
    if (navigator.share) {
      navigator.share({ title: 'SpeedFlex rematch', text: shareText(), url: link }).catch(function (err) {
        if (!err || err.name !== 'AbortError') copyLink();
      });
    } else {
      copyText(link).then(function (ok) {
        status(ok ? 'Rematch link copied. Your move.' : 'Copy this link: ' + link);
        $('share-status').scrollIntoView({ block: 'nearest' });
      });
    }
  }
  function enableShare() {
    var has = !!(lastResult && lastResult.d != null);
    $('btn-share').disabled = !has;
    $('btn-link').disabled = !has;
    status(has ? 'Your share card is ready.' : 'The download test failed, so there is nothing to share yet.');
    refreshPreview();
  }

  /* ---------- History ---------- */
  function readHistory() {
    try {
      var arr = JSON.parse(load(HISTORY_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(function (h) { return h && typeof h === 'object' && num(h.t); }).slice(0, 5) : [];
    } catch (e) { return []; }
  }
  function saveHistory(r) {
    try {
      var arr = readHistory();
      arr.unshift({ d: r.d, u: r.u, p: r.p, g: r.g, t: r.t });
      store(HISTORY_KEY, JSON.stringify(arr.slice(0, 5)));
    } catch (e) { /* ignore */ }
  }
  function renderHistory() {
    var list = $('h-list'), items = readHistory();
    list.textContent = '';
    $('btn-clear').hidden = !items.length;
    if (!items.length) {
      var e = document.createElement('li');
      e.className = 'h-empty';
      e.textContent = 'No previous tests on this device yet.';
      list.appendChild(e);
      return;
    }
    items.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('span');
      a.textContent = '↓ ' + fmtMbps(num(h.d) ? h.d : null) + ' · ↑ ' + fmtMbps(num(h.u) ? h.u : null) + ' Mbps';
      var b = document.createElement('span');
      b.textContent = fmtMs(num(h.p) ? h.p : null) + ' ms' + (typeof h.g === 'string' ? ' · ' + h.g.slice(0, 2) : '');
      var w = document.createElement('span');
      w.className = 'h-when';
      w.textContent = fmtDateTime(h.t);
      li.appendChild(w); li.appendChild(a); li.appendChild(b);
      list.appendChild(li);
    });
  }

  /* ---------- Wiring ---------- */
  function init() {
    buildGauge();
    paintGauge(0);
    renderLadder(null);
    applyChallenge();
    renderHistory();

    var savedName = load(NAME_KEY);
    if (savedName) $('name-in').value = sanitizeName(savedName);
    var savedPlan = load(PLAN_KEY);
    if (savedPlan && parseFloat(savedPlan) > 0) $('plan-in').value = savedPlan;
    renderPlan();

    $('btn-again').addEventListener('click', startTest);
    $('btn-stop').addEventListener('click', stopTest);
    $('btn-share').addEventListener('click', shareResult);
    $('btn-link').addEventListener('click', copyLink);
    $('btn-challenge-back').addEventListener('click', challengeBack);
    $('plan-in').addEventListener('input', renderPlan);
    $('btn-copy-msg').addEventListener('click', function () {
      copyText($('complaint-text').value).then(function (ok) {
        $('btn-copy-msg').textContent = ok ? 'Copied' : 'Select the text and copy';
        setTimeout(function () { $('btn-copy-msg').textContent = 'Copy message'; }, 2200);
      });
    });
    var nameT;
    $('name-in').addEventListener('input', function () {
      clearTimeout(nameT);
      nameT = setTimeout(function () {
        var n = sanitizeName($('name-in').value);
        if (n) store(NAME_KEY, n); else drop(NAME_KEY);
        if (lastResult) { refreshPreview(); renderPlan(); }
      }, 250);
    });
    $('btn-clear').addEventListener('click', function () {
      drop(HISTORY_KEY);
      renderHistory();
      $('history-h').setAttribute('tabindex', '-1');
      $('history-h').focus();
    });
    window.addEventListener('hashchange', applyChallenge);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && running) stopTest();
    });

    setTimeout(startTest, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
