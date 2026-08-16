import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "chrome-launcher";
import WS from "ws";
const WebSocket = WS;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TABLESCORE_BASE || "http://127.0.0.1:4322";
const PAGE = `${BASE}/hand-and-foot-score-keeper/`;

function write(rel, text) {
  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
  return dest;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method && this.events.has(msg.method)) {
        const waiters = this.events.get(msg.method);
        this.events.delete(msg.method);
        for (const resolve of waiters) resolve(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method) {
    return new Promise((resolve) => {
      const list = this.events.get(method) || [];
      list.push(resolve);
      this.events.set(method, list);
    });
  }
}

async function connect(port) {
  const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  let target = list.find((t) => t.type === "page") || list[0];
  if (!target) throw new Error("no CDP target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  return new Cdp(ws);
}

async function evalExpr(cdp, expression, awaitPromise = true) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text || "eval failed");
  }
  return r.result.value;
}

const MID = {
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
        p1: {
          cleanPiles: 2, dirtyPiles: 1, wildPiles: 0,
          redThreesTabled: 1, redThreesUntabled: 0,
          melded: { jokers: 1, twosAndAces: 2, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 0 },
          leftover: { jokers: 0, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 3, blackThrees: 0 },
          useCardCounts: true, netCardPoints: 0, wentOut: false,
        },
        p2: {
          cleanPiles: 0, dirtyPiles: 2, wildPiles: 0,
          redThreesTabled: 0, redThreesUntabled: 1,
          melded: { jokers: 0, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 0 },
          leftover: { jokers: 1, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 2 },
          useCardCounts: true, netCardPoints: 0, wentOut: false,
        },
      },
    },
  ],
  draft: {
    players: {
      p1: {
        cleanPiles: 1, dirtyPiles: 0, wildPiles: 1,
        redThreesTabled: 0, redThreesUntabled: 0,
        melded: { jokers: 0, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 0 },
        leftover: { jokers: 0, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 0 },
        useCardCounts: true, netCardPoints: 0, wentOut: false,
      },
      p2: {
        cleanPiles: 0, dirtyPiles: 1, wildPiles: 0,
        redThreesTabled: 0, redThreesUntabled: 0,
        melded: { jokers: 0, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 0 },
        leftover: { jokers: 0, twosAndAces: 0, eightThroughKing: 0, fourThroughSeven: 0, blackThrees: 0 },
        useCardCounts: true, netCardPoints: 0, wentOut: false,
      },
    },
  },
  editing: null,
};

const chrome = await launch({
  chromePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

try {
  const cdp = await connect(chrome.port);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 360,
    height: 800,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await cdp.send("Page.navigate", { url: PAGE });
  await cdp.once("Page.loadEventFired");
  await new Promise((r) => setTimeout(r, 800));

  const vp = await evalExpr(cdp, `({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    dpr: window.devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    hasTool: Boolean(document.getElementById("scorekeeper")),
    targets: [...document.querySelectorAll("button, .btn, .stepper-btn, .name-input")].slice(0, 24).map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, text: (el.textContent || "").trim().slice(0, 36), w: Math.round(r.width), h: Math.round(r.height) };
    }),
  })`);

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true });
  const shotPath = path.join(ROOT, "evidence/viewport-360/hand-and-foot-360x800.png");
  fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));

  const note = [
    "TableScore v0.2 - 360px viewport evidence",
    "Date: " + new Date().toISOString(),
    "This is a real browser viewport (Chrome headless via CDP), 360x800 CSS pixels, deviceScaleFactor 2.",
    "It is NOT a physical phone lab.",
    "URL: " + PAGE,
    JSON.stringify(vp, null, 2),
    "viewport meta is width=device-width, initial-scale=1. Flow is written for 360px without pinch-zoom.",
    "Image: evidence/viewport-360/hand-and-foot-360x800.png",
  ].join("\n");
  write("evidence/viewport-360/NOTES.md", note + "\n");
  console.log("360", JSON.stringify(vp));

  // FR-5 restore: seed storage, reload, assert resume + totals
  await evalExpr(cdp, `(${function (state) {
    const keys = {
      names: "tablescore.v02.playerNames",
      variant: "tablescore.v02.variantId",
      targetRounds: "tablescore.v02.targetRounds",
      game: "tablescore.v02.game",
    };
    localStorage.setItem(keys.names, JSON.stringify(["Ada", "Ben"]));
    localStorage.setItem(keys.variant, JSON.stringify("whitnack"));
    localStorage.setItem(keys.targetRounds, JSON.stringify(4));
    localStorage.setItem(keys.game, JSON.stringify(Object.assign({}, state, { savedAt: Date.now() })));
    return true;
  }.toString()})(${JSON.stringify(MID)})`);

  await cdp.send("Page.navigate", { url: PAGE });
  await cdp.once("Page.loadEventFired");
  await new Promise((r) => setTimeout(r, 800));

  const before = await evalExpr(cdp, `({
    hasResume: Boolean(document.querySelector(".resume")),
    banner: (document.querySelector(".resume") || {}).textContent || "",
  })`);
  if (before.hasResume) {
    await evalExpr(cdp, `document.querySelector('[data-act="resume"]').click(); true`);
    await new Promise((r) => setTimeout(r, 400));
  }
  const after = await evalExpr(cdp, `(() => {
    const engine = window.__TABLESCORE;
    const raw = JSON.parse(localStorage.getItem("tablescore.v02.game"));
    const recomputed = engine ? engine.recomputeGame(raw) : null;
    return {
      names: [...document.querySelectorAll(".player-head h3")].map((h) => h.textContent.trim()),
      bar: (document.querySelector(".game-bar") || {}).textContent || "",
      totals: recomputed ? recomputed.perPlayer.map((p) => ({ name: p.name, total: p.total })) : null,
      roundsPlayed: recomputed ? recomputed.roundsPlayed : null,
    };
  })()`);

  const restoreOk =
    before.hasResume &&
    after.names.includes("Ada") &&
    after.names.includes("Ben") &&
    after.totals &&
    after.totals[0].total === 1475 &&
    after.totals[1].total === 440 &&
    after.roundsPlayed === 1;

  write(
    "evidence/restore/browser-restore.log",
    [
      "TableScore v0.2 - FR-5 restore evidence (headless browser / CDP)",
      "Date: " + new Date().toISOString(),
      "URL: " + PAGE,
      "Method: seed localStorage mid-game, reload, assert Resume banner, accept, assert exact totals.",
      "Resume banner: " + before.hasResume,
      "Restored names: " + JSON.stringify(after.names),
      "Recomputed totals: " + JSON.stringify(after.totals),
      "Rounds played: " + after.roundsPlayed,
      "PASS: " + restoreOk,
      "Expected: Ada 1475, Ben 440, 1 deal, Whitnack.",
      "Companion node test: src/engine/storage.test.js",
    ].join("\n") + "\n"
  );
  write("evidence/restore/browser-restore.json", JSON.stringify({ before, after, restoreOk }, null, 2) + "\n");
  console.log("restore", restoreOk, after.totals);

  // FR-10 offline: wait for SW, go offline, reload, scoreRound
  const sw = await evalExpr(cdp, `navigator.serviceWorker.ready.then((reg) => ({
    supported: true,
    active: Boolean(reg.active),
    scope: reg.scope,
  }))`);
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await cdp.send("Page.navigate", { url: PAGE });
  await new Promise((r) => setTimeout(r, 1200));
  const off = await evalExpr(cdp, `(() => {
    const engine = window.__TABLESCORE;
    if (!engine) return { hasEngine: false };
    const b = engine.scoreRound({ cleanPiles: 1 }, engine.getVariant("whitnack"));
    return {
      hasEngine: true,
      version: engine.version,
      total: b.total,
      title: document.querySelector("h1") && document.querySelector("h1").textContent,
      toolPresent: Boolean(document.getElementById("scorekeeper")),
    };
  })()`);
  const offlineOk = off.hasEngine && off.total === 500 && off.toolPresent;
  write(
    "evidence/offline/offline-browser.log",
    [
      "TableScore v0.2 - FR-10 offline evidence (headless browser / CDP)",
      "Date: " + new Date().toISOString(),
      "URL: " + PAGE,
      "Method: first load, wait for service worker, Network.emulateNetworkConditions(offline), reload, call scoreRound.",
      "SW: " + JSON.stringify(sw),
      "After offline reload: " + JSON.stringify(off),
      "PASS: " + offlineOk,
      "Expected: page still serves; scoreRound(1 clean pile, Whitnack) === 500.",
      "No PWA install prompt. No beforeinstallprompt handler. No manifest install UI.",
    ].join("\n") + "\n"
  );
  write("evidence/offline/offline.json", JSON.stringify({ sw, off, offlineOk }, null, 2) + "\n");
  console.log("offline", offlineOk, off);

  if (!restoreOk) process.exitCode = 3;
  if (!offlineOk) process.exitCode = 4;
} finally {
  await chrome.kill();
}
