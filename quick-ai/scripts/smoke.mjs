/**
 * Headless end-to-end smoke test: describe -> questions -> recommendation.
 * Run: node scripts/smoke.mjs (requires `npm run build` + a preview server,
 * which this script starts itself).
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  stdio: 'pipe',
  detached: true, // own process group, so we can kill the whole npx->vite tree
});
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server timeout')), 15000);
  preview.stdout.on('data', (d) => {
    if (d.toString().includes('4173')) { clearTimeout(t); resolve(); }
  });
  preview.on('exit', (code) => reject(new Error(`preview exited: ${code}`)));
});

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
};

try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto('http://localhost:4173/');

  check('homepage shows tagline', (await page.textContent('h1')).includes('Right AI'));
  check('local-processing badge visible', await page.isVisible('.local-badge'));

  // Flow 1: 600-page spec -> multimodal long-context recommendation
  await page.fill('#description', 'Analyze a 600-page technical specification with diagrams');
  await page.click('#btn-start');
  await page.waitForSelector('#step-questions:not(.hidden)');
  check('prefill note appears', await page.isVisible('#prefill-note'));
  await page.selectOption('#q-complexity', 'complex');
  await page.click('#btn-route');
  await page.waitForSelector('#step-result:not(.hidden)');
  const result1 = await page.textContent('#step-result');
  check('recommendation rendered', result1.includes('Best fit') || result1.includes('BEST'));
  check('explains why it won', result1.includes('Why it won'));
  check('shows confidence', /Confidence: (HIGH|MEDIUM|LOW)/.test(result1));
  check('shows workflow', result1.includes('Recommended workflow'));

  // Flow 2: exact arithmetic -> no-AI outcome
  await page.click('#btn-again');
  await page.fill('#description', 'Sum a column of 2000 numbers exactly');
  await page.click('#btn-start');
  await page.waitForSelector('#step-questions:not(.hidden)');
  await page.click('#btn-route');
  await page.waitForSelector('#step-result:not(.hidden)');
  const result2 = await page.textContent('#step-result');
  check('no-AI outcome works end to end', result2.includes("Don't use AI"));

  check('no page errors', consoleErrors.length === 0);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
} finally {
  await browser.close();
  try { process.kill(-preview.pid, 'SIGTERM'); } catch { preview.kill(); }
}

process.exit(failures > 0 ? 1 : 0);
