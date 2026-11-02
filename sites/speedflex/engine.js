/*
 * SpeedFlex measurement engine. Vanilla browser script with no dependencies.
 * Exposes window.SpeedEngine = { DEFAULT_BASE, run(opts), gradeBufferbloat(deltaMs) }.
 *
 * OWNER APPROVAL REQUIRED: DEFAULT_BASE points at Cloudflare's public speed-test
 * endpoints (/__down, /__up, /meta). That is a third-party network dependency, and
 * Cloudflare's terms for third-party use must be reviewed before launch. This is the
 * only place the base URL is set. The UI may pass opts.base (a localhost mock in dev).
 *
 * Method (see specs/speedflex.md):
 *  1. meta: best-effort GET /meta (ISP, city, country, colo). Any failure gives null.
 *  2. latency: 1 warm-up + 20 sequential GET /__down?bytes=0. Each sample is
 *     requestStart->responseStart from Resource Timing, minus Server-Timing
 *     cfRequestDuration. If timing is not exposed (no Timing-Allow-Origin), it uses
 *     wall-clock time. Reports the median; jitter = mean |consecutive difference|.
 *  3. download: up to 6 staggered fetch streams. Each stream's request size ramps
 *     (x4 per request, from 100kB up to 25MB) towards about 750ms per request. Bytes
 *     are counted from response.body.getReader(), spread over the time between
 *     chunks, and binned into 200ms buckets. The result is the 90th percentile of
 *     rolling 1s windows (stepped every 200ms) after a 1s warm-up. Raw 200ms
 *     windows overstate slow links, where chunks arrive in bursts. Capped at 8s, and it ends early once the 1s rate is
 *     stable (within 5%) for 0.5s.
 *  4. upload: the same scheme with XHR POST /__up, using slices of one pre-generated
 *     pseudo-random 8MB Blob. upload.onprogress drives the live gauge only. Windows use
 *     completed requests spread over their duration, because progress counts bytes
 *     that are still in socket buffers and overshoots. Progress listeners force a CORS
 *     preflight, so if the first POST fails, the engine retries without them.
 *  5. loaded latency: pings every ~250ms during download and upload (median of each).
 *     Bufferbloat delta = max(loadedDown, loadedUp) - idle, graded by gradeBufferbloat.
 * GETs carry a cache-busting param. POST /__up keeps a fixed URL so the preflight is
 * cached. A failed phase yields null for its numbers and never throws. Aborting via
 * opts.signal rejects with an AbortError and cancels every in-flight request.
 */
(function () {
  'use strict';
  var DEFAULT_BASE = 'https://speed.cloudflare.com';
  var CAP = 8000, WARM = 1000, WIN = 200, ROLL = 5, TICK = 100, STREAMS = 6, TARGET_MS = 750;
  var MIN_REQ = 1e5, MAX_DOWN = 25e6, MAX_UP = 8e6, IDLE_PINGS = 20, LOAD_PING_MS = 250;
  var perf = window.performance;
  var now = function () { return perf.now(); };
  var abortErr = function () { return new DOMException('Speed test aborted', 'AbortError'); };
  var sorted = function (a) { return a.slice().sort(function (x, y) { return x - y; }); };
  var pct = function (a, p) { var s = sorted(a); return s.length ? s[Math.max(0, Math.ceil(p * s.length) - 1)] : null; };
  var median = function (a) { var s = sorted(a), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  var r1 = function (x) { return x == null || !isFinite(x) ? null : Math.round(x * 10) / 10; };
  var r0 = function (x) { return x == null || !isFinite(x) ? null : Math.round(x); };

  // A sleep that a signal can cut short (it resolves early and never rejects).
  function sleep(ms, sig) {
    return new Promise(function (res) {
      var t = setTimeout(res, ms);
      if (sig) sig.addEventListener('abort', function () { clearTimeout(t); res(); }, { once: true });
    });
  }
  // A controller that aborts when its parent signal aborts. It can also be aborted alone.
  function child(sig) {
    var c = new AbortController();
    if (sig.aborted) c.abort(); else sig.addEventListener('abort', function () { c.abort(); }, { once: true });
    return c;
  }

  var BLOB = null; // Reused upload payload. Pseudo-random (xorshift) so nothing on the path can compress it.
  function upBlob() {
    if (!BLOB) {
      var a = new Uint32Array(MAX_UP / 4), x = 0x9e3779b9;
      for (var i = 0; i < a.length; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; a[i] = x; }
      BLOB = new Blob([a]);
    }
    return BLOB;
  }

  function gradeBufferbloat(d) {
    if (d == null || !isFinite(d)) return null;
    return d < 5 ? 'A+' : d < 30 ? 'A' : d < 60 ? 'B' : d < 200 ? 'C' : d < 400 ? 'D' : 'F';
  }

  function run(opts) {
    opts = opts || {};
    var ext = opts.signal, ac = new AbortController();
    return new Promise(function (resolve, reject) {
      if (ext && ext.aborted) return reject(abortErr());
      var onAbort = function () { ac.abort(); reject(abortErr()); }; // reject promptly, tear down in background
      if (ext) ext.addEventListener('abort', onAbort, { once: true });
      test(opts, ac.signal).then(resolve, function (e) { reject(ac.signal.aborted ? abortErr() : e); })
        .then(function () { if (ext) ext.removeEventListener('abort', onAbort); });
    });
  }

  async function test(opts, sig) {
    var base = String(opts.base || DEFAULT_BASE).replace(/\/+$/, '');
    var startedAt = new Date().toISOString(), T0 = now(), seq = 0, lastEmit = 0;
    var abs = function (p) { return new URL(base + p, location.href).href; };
    var bust = function (p, q) { return abs(p + '?' + (q ? q + '&' : '') + 'r=' + Date.now().toString(36) + (seq++).toString(36)); };
    var fo = function (s) { return { cache: 'no-store', credentials: 'omit', signal: s }; };
    var check = function () { if (sig.aborted) throw abortErr(); };
    var phase = function (p) { try { if (opts.onPhase) opts.onPhase(p); } catch (_) {} };
    var emit = function (e) { // throttled to <= ~10/s
      var t = now(); if (t - lastEmit < 95) return; lastEmit = t;
      try { if (opts.onProgress) opts.onProgress(e); } catch (_) {}
    };

    // Resource Timing hygiene: a bigger buffer, cleared when full so new entries still land.
    var clearRT = function () { try { perf.clearResourceTimings(); } catch (_) {} };
    try { perf.setResourceTimingBufferSize(1000); } catch (_) {}
    try { perf.addEventListener('resourcetimingbufferfull', clearRT); } catch (_) {}
    var rt = function (u) { try { var l = perf.getEntriesByName(u, 'resource'); return l[l.length - 1]; } catch (_) { return null; } };

    async function ping(s) {
      var u = bust('/__down', 'bytes=0'), t = now();
      var r = await fetch(u, fo(s));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await r.arrayBuffer();
      var wall = now() - t, e = rt(u);
      if (!e) { await sleep(0); e = rt(u); }
      if (e && e.requestStart > 0 && e.responseStart >= e.requestStart) { // 0 = cross-origin without TAO
        var v = e.responseStart - e.requestStart;
        var st = (e.serverTiming || []).filter(function (x) { return x.name === 'cfRequestDuration'; })[0];
        if (st && st.duration > 0 && st.duration < v) v -= st.duration;
        if (v > 0) return v;
      }
      return wall;
    }

    async function getMeta() {
      var c = child(sig), t = setTimeout(function () { c.abort(); }, 3000);
      try {
        var r = await fetch(bust('/meta'), fo(c.signal));
        if (!r.ok) return null;
        var j = await r.json() || {};
        var s = function (v) { return (typeof v === 'string' || typeof v === 'number') && String(v).trim() ? String(v).trim().slice(0, 80) : null; };
        var m = { isp: s(j.asOrganization) || s(j.isp) || s(j.org), city: s(j.city), country: s(j.country), colo: s(j.colo) };
        return (m.isp || m.city || m.country || m.colo) ? m : null;
      } catch (_) { return null; } finally { clearTimeout(t); }
    }

    // One throughput phase. kind is 'down' or 'up'.
    async function measure(kind) {
      var pc = child(sig), ps = pc.signal, t0 = now();
      var buckets = new Float64Array(Math.ceil(CAP / WIN) + 1);
      var add = function (s, e, b) { // spread b bytes uniformly over [s, e] into 200ms buckets
        s -= t0; e -= t0;
        if (e - s < 0.5) { var k0 = Math.floor(e / WIN); if (k0 >= 0 && k0 < buckets.length) buckets[k0] += b; return; }
        for (var k = Math.max(0, Math.floor(s / WIN)); k * WIN < e && k < buckets.length; k++)
          buckets[k] += b * (Math.min(e, (k + 1) * WIN) - Math.max(s, k * WIN)) / (e - s);
      };
      var live = 0, done = 0, alive = STREAMS, anyOk = false, useProgress = true, lastPing;
      var lastOk = [], failed = [], loaded = [], max = kind === 'down' ? MAX_DOWN : MAX_UP;

      async function down1(size) {
        var r = await fetch(bust('/__down', 'bytes=' + size), fo(ps));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var prev = now(), got = 0;
        if (!r.body || !r.body.getReader) { got = (await r.arrayBuffer()).byteLength; live += got; add(prev, now(), got); return got; }
        var rd = r.body.getReader();
        for (;;) {
          var c = await rd.read();
          if (c.done) return got;
          var t = now(), n = c.value.byteLength;
          add(prev, t, n); prev = t; live += n; got += n;
        }
      }
      function up1(size) {
        return new Promise(function (res, rej) {
          var x = new XMLHttpRequest(), sent = 0, kill = function () { x.abort(); };
          x.open('POST', abs('/__up'));
          if (useProgress) x.upload.onprogress = function (e) { live += e.loaded - sent; sent = e.loaded; };
          x.onload = function () {
            live += size - sent; sent = size;
            if (x.status >= 200 && x.status < 300) res(size); else rej(new Error('HTTP ' + x.status));
          };
          x.onerror = x.onabort = x.ontimeout = function () { rej(new Error('XHR failed')); };
          x.onloadend = function () { ps.removeEventListener('abort', kill); };
          ps.addEventListener('abort', kill, { once: true });
          x.send(upBlob().slice(0, size));
        });
      }
      async function stream(i) {
        await sleep(i * 150, ps); // stagger: ramp up parallelism
        var size = MIN_REQ, fails = 0;
        while (!ps.aborted) {
          var st = now();
          try {
            var b = kind === 'down' ? await down1(size) : await up1(size), t = now();
            anyOk = true; fails = 0; lastOk[i] = t;
            if (kind === 'up') { add(st, t, b); done += b; }
            size = Math.round(Math.min(max, size * 4, Math.max(MIN_REQ, b / Math.max(1, t - st) * TARGET_MS)));
          } catch (e) {
            if (ps.aborted) break;
            if (kind === 'up' && useProgress && !anyOk) { useProgress = false; continue; } // preflight probably refused
            if (++fails >= 3) { failed[i] = true; break; }
            await sleep(300, ps);
          }
        }
        alive--;
      }
      async function pinger() { // loaded latency
        while (!ps.aborted) {
          var t = now();
          try { var v = await ping(ps); if (!ps.aborted) { loaded.push(v); lastPing = v; } } catch (_) {}
          await sleep(Math.max(0, LOAD_PING_MS - (now() - t)), ps);
        }
      }

      var tasks = [pinger()];
      for (var i = 0; i < STREAMS; i++) tasks.push(stream(i));
      var hist = [[0, 0]], stable = 0;
      await new Promise(function (resolve) {
        var iv = setInterval(function () {
          var el = now() - t0; hist.push([el, live]);
          var n = hist.length;
          var rate = function (a, b) { var p = hist[Math.max(0, a)], q = hist[b]; return q[0] > p[0] ? (q[1] - p[1]) * 8 / (q[0] - p[0]) / 1000 : 0; };
          var cur = rate(n - 11, n - 1); // live Mbps over the last ~1s
          emit({ phase: kind === 'down' ? 'download' : 'upload', progress: Math.min(1, el / CAP), mbps: r1(cur), latencyMs: r0(lastPing) });
          if (el > 3000 && n > 21) {
            var prev = rate(n - 21, n - 11);
            stable = cur > 0 && Math.abs(cur - prev) <= 0.05 * Math.max(cur, prev) ? stable + 1 : 0;
          }
          if (el >= CAP || stable >= 5 || alive <= 0 || ps.aborted) { clearInterval(iv); resolve(); }
        }, TICK);
      });
      var tEnd = now() - t0;
      pc.abort();
      await Promise.all(tasks);
      if (kind === 'up') { // only time covered by completed requests on every live stream is fully counted
        var ends = lastOk.filter(function (t, j) { return t && !failed[j]; });
        tEnd = ends.length ? Math.min.apply(null, ends) - t0 : 0;
      }
      // Rolling 1s windows (5 buckets) stepped every 200ms, from after warm-up to the covered end.
      var w = [], a0 = Math.ceil(WARM / WIN), a1 = Math.floor(tEnd / WIN), sum = 0;
      for (var k = a0; k < a1; k++) {
        sum += buckets[k]; if (k - a0 >= ROLL) sum -= buckets[k - ROLL];
        if (k - a0 >= ROLL - 1) w.push(sum * 8 / (ROLL * WIN) / 1000);
      }
      var total = kind === 'down' ? live : done, el = now() - t0;
      var mbps = w.length >= 3 ? pct(w, 0.9) : total > 0 ? total * 8 / el / 1000 : null;
      return { mbps: anyOk || total > 0 ? mbps : null, bytes: live, loaded: median(loaded) };
    }

    try {
      phase('meta');
      var meta = await getMeta(); check();

      phase('latency');
      var idle = [], fails = 0;
      for (var i = 0; i <= IDLE_PINGS; i++) {
        try {
          var v = await ping(sig);
          if (i) { idle.push(v); emit({ phase: 'latency', progress: idle.length / IDLE_PINGS, latencyMs: r0(v) }); }
        } catch (e) { check(); if (++fails > 5 && !idle.length) break; }
      }
      check();
      var jit = 0;
      for (var k = 1; k < idle.length; k++) jit += Math.abs(idle[k] - idle[k - 1]);
      var idleMs = median(idle), jitter = idle.length > 1 ? jit / (idle.length - 1) : null;

      phase('download');
      var dn = await measure('down'); check();
      phase('upload');
      var up = await measure('up'); check();

      var ld = [dn.loaded, up.loaded].filter(function (x) { return x != null; });
      var delta = idleMs != null && ld.length ? Math.max(0, Math.max.apply(null, ld) - idleMs) : null;
      var res = {
        downloadMbps: r1(dn.mbps), uploadMbps: r1(up.mbps),
        idleLatencyMs: r0(idleMs), jitterMs: r0(jitter),
        loadedLatencyDownMs: r0(dn.loaded), loadedLatencyUpMs: r0(up.loaded),
        bufferbloatDeltaMs: r0(delta), bufferbloatGrade: gradeBufferbloat(delta == null ? null : Math.round(delta)),
        meta: meta, bytesUsed: Math.round(dn.bytes + up.bytes),
        durationMs: Math.round(now() - T0), startedAt: startedAt
      };
      phase('done');
      return res;
    } finally {
      try { perf.removeEventListener('resourcetimingbufferfull', clearRT); } catch (_) {}
      clearRT();
    }
  }

  window.SpeedEngine = { DEFAULT_BASE: DEFAULT_BASE, run: run, gradeBufferbloat: gradeBufferbloat };
})();
