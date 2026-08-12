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

  // Flow 3: Agent or Chat? tool — daily monitoring -> automation, not agent hype
  await page.click('#btn-again');
  await page.click('#tab-agent');
  check('constraints question hidden in agent mode', await page.isHidden('#fieldset-constraints'));
  await page.fill('#description', 'Monitor a website every day for price changes');
  await page.click('#btn-start');
  await page.waitForSelector('#step-questions:not(.hidden)');
  await page.click('#btn-route');
  await page.waitForSelector('#step-result:not(.hidden)');
  const result3 = await page.textContent('#step-result');
  check('agent-or-chat renders a mode', /chat|agent|automation|software/i.test(result3));
  check('agent-or-chat explains itself', result3.includes('Why'));

  // Flow 4: Model Downgrader — frontier model on a simple task -> downgrade
  await page.click('#btn-again');
  await page.click('#tab-downgrade');
  await page.fill('#description', 'Classify customer reviews as positive or negative');
  await page.click('#btn-start');
  await page.waitForSelector('#step-questions:not(.hidden)');
  check('current-model question visible in downgrader mode', await page.isVisible('#fieldset-current-model'));
  await page.selectOption('#q-current-model', 'claude-opus-5');
  await page.click('#btn-route');
  await page.waitForSelector('#step-result:not(.hidden)');
  const result4 = await page.textContent('#step-result');
  check('downgrader suggests a cheaper switch', /switch to|cheaper/i.test(result4));

  // Flow 5: Cost Leak — premium model + repeated context, no caching
  await page.click('#btn-again');
  await page.click('#tab-cost');
  await page.fill('#description', 'Classify support tickets with an expensive model');
  await page.click('#btn-start');
  await page.waitForSelector('#step-cost:not(.hidden)');
  await page.selectOption('#qc-model', 'claude-fable-5');
  await page.selectOption('#qc-complexity', 'simple');
  await page.check('#qc-repeated');
  await page.selectOption('#qc-caching', 'no');
  await page.click('#btn-diagnose');
  await page.waitForSelector('#step-result:not(.hidden)');
  const result5 = await page.textContent('#step-result');
  check('cost leak finds the premium-model leak', /Premium model/i.test(result5));
  check('cost leak finds the caching leak', /caching/i.test(result5));
  check('cost leak proposes cheaper architecture', /Cheaper architecture/i.test(result5));

  // Flow 6: Can AI Handle This? — local file inspection
  await page.click('#btn-again');
  await page.click('#tab-inspect');
  await page.waitForSelector('#step-inspect:not(.hidden)');
  await page.setInputFiles('#q-file', {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello world. '.repeat(2000)),
  });
  await page.waitForSelector('#step-result:not(.hidden)');
  const result6 = await page.textContent('#step-result');
  check('file inspector renders a verdict', /direct processing|preprocessing|chunk/i.test(result6));
  check('file inspector shows a token estimate', /tokens/i.test(result6));
  check('file inspector states local processing', /processed locally/i.test(result6));

  check('no page errors', consoleErrors.length === 0);
  if (consoleErrors.length) console.log(consoleErrors.join('\n'));
} finally {
  await browser.close();
  try { process.kill(-preview.pid, 'SIGTERM'); } catch { preview.kill(); }
}

process.exit(failures > 0 ? 1 : 0);
