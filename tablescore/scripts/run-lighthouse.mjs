import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lighthouse = (await import("lighthouse")).default;
const { launch } = await import("chrome-launcher");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const url = process.env.TABLESCORE_URL || "http://127.0.0.1:4321/hand-and-foot-score-keeper/";
const outDir = path.join(ROOT, "evidence", "lighthouse");
fs.mkdirSync(outDir, { recursive: true });

const chrome = await launch({
  chromePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

try {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: ["json", "html"],
    logLevel: "info",
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2,
      disabled: false,
    },
    throttlingMethod: "simulate",
  });
  const lhr = result.lhr;
  const perf = lhr.categories.performance.score * 100;
  const cls = lhr.audits["cumulative-layout-shift"].numericValue;
  const stamp = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, "lighthouse-mobile.json"), result.report[0]);
  fs.writeFileSync(path.join(outDir, "lighthouse-mobile.html"), result.report[1]);
  const summary = {
    date: stamp,
    url,
    formFactor: "mobile",
    performance: perf,
    cls,
    lcp: lhr.audits["largest-contentful-paint"]?.numericValue,
    fcp: lhr.audits["first-contentful-paint"]?.numericValue,
    tbt: lhr.audits["total-blocking-time"]?.numericValue,
    si: lhr.audits["speed-index"]?.numericValue,
    gate: { performanceMin: 90, clsMax: 0.1, pass: perf >= 90 && cls < 0.1 },
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.gate.pass) {
    process.exitCode = 2;
  }
} finally {
  await chrome.kill();
}
