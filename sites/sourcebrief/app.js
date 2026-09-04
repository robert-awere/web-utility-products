const GITHUB_API = 'https://api.github.com';
const HOME_URL = 'https://www.sourcebrief.io/';
const FEEDBACK_ISSUE_URL = 'https://github.com/robert-awere/web-utility-products/issues/new';

const state = {
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  currentAnalysis: null,
};

const meta = {
  description: document.querySelector('#meta-description'),
  canonical: document.querySelector('#canonical-link'),
  ogTitle: document.querySelector('#og-title'),
  ogDescription: document.querySelector('#og-description'),
  ogUrl: document.querySelector('#og-url'),
};

const homeMeta = {
  title: document.title,
  description: meta.description?.content || '',
  canonical: meta.canonical?.href || HOME_URL,
  ogTitle: meta.ogTitle?.content || document.title,
  ogDescription: meta.ogDescription?.content || '',
  ogUrl: meta.ogUrl?.content || HOME_URL,
};

const els = {
  form: document.querySelector('#repo-form'),
  input: document.querySelector('#repo-input'),
  help: document.querySelector('#form-help'),
  status: document.querySelector('#status-panel'),
  statusMessage: document.querySelector('#status-message'),
  results: document.querySelector('#results'),
  newScan: document.querySelector('#new-scan'),
  resultSource: document.querySelector('#result-source'),
  title: document.querySelector('#results-title'),
  headline: document.querySelector('#result-headline'),
  githubLink: document.querySelector('#github-link'),
  shareLink: document.querySelector('#share-link'),
  metricGrid: document.querySelector('#metric-grid'),
  purpose: document.querySelector('#summary-purpose'),
  audience: document.querySelector('#summary-audience'),
  pitch: document.querySelector('#summary-pitch'),
  verdictLabel: document.querySelector('#verdict-label'),
  verdictList: document.querySelector('#verdict-list'),
  verdictRationale: document.querySelector('#verdict-rationale'),
  scorecard: document.querySelector('#scorecard'),
  howToUse: document.querySelector('#how-to-use'),
  techStack: document.querySelector('#tech-stack'),
  depSummary: document.querySelector('#dependency-summary'),
  architectureMap: document.querySelector('#architecture-map'),
  complexityMap: document.querySelector('#complexity-map'),
  risks: document.querySelector('#risks'),
  opportunities: document.querySelector('#opportunities'),
  promptBoard: document.querySelector('#prompt-board'),
  evidence: document.querySelector('#evidence'),
  relatedRepos: document.querySelector('#related-repos'),
  feedbackForm: document.querySelector('#feedback-form'),
  feedbackTone: document.querySelectorAll('input[name="tone"]'),
  feedbackMessage: document.querySelector('#feedback-message'),
  feedbackIssueLink: document.querySelector('#feedback-issue-link'),
  feedbackCopy: document.querySelector('#feedback-copy'),
  feedbackStatus: document.querySelector('#feedback-status'),
};

document.documentElement.setAttribute('data-theme', state.theme);
document.querySelector('#year').textContent = new Date().getFullYear();

document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
});

els.newScan.addEventListener('click', () => {
  showHome({ focusInput: true, clearUrl: true });
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runScan(els.input.value, { writeUrl: true, scrollToResults: true });
});

els.shareLink.addEventListener('click', async () => {
  try {
    await copyText(location.href);
    els.shareLink.textContent = 'Result link copied';
    setTimeout(() => {
      els.shareLink.textContent = 'Copy result link';
    }, 1400);
  } catch {
    els.shareLink.textContent = 'Copy failed';
    setTimeout(() => {
      els.shareLink.textContent = 'Copy result link';
    }, 1400);
  }
});

els.feedbackForm.addEventListener('input', updateFeedbackIssueLink);
els.feedbackForm.addEventListener('change', updateFeedbackIssueLink);

els.feedbackCopy.addEventListener('click', async () => {
  try {
    await copyText(buildFeedbackBody());
    els.feedbackStatus.textContent = 'Feedback copied. Paste it wherever you prefer.';
    els.feedbackCopy.textContent = 'Copied';
  } catch {
    els.feedbackStatus.textContent = 'Copy failed. You can still open the prefilled GitHub issue.';
    els.feedbackCopy.textContent = 'Copy failed';
  }

  setTimeout(() => {
    els.feedbackCopy.textContent = 'Copy feedback';
    updateFeedbackIssueLink();
  }, 1400);
});

window.addEventListener('popstate', () => {
  const repo = getRepoFromUrl();
  if (repo) {
    els.input.value = repo.value;
    runScan(repo.value, { writeUrl: false, scrollToResults: true });
    return;
  }
  showHome({ focusInput: false, clearUrl: false });
});

const initialRepo = getRepoFromUrl();
if (initialRepo) {
  els.input.value = initialRepo.value;
  runScan(initialRepo.value, { writeUrl: true, replaceUrl: true, scrollToResults: true });
}

async function runScan(input, options = {}) {
  const { writeUrl = false, replaceUrl = false, scrollToResults = false } = options;
  const parsed = parseRepoInput(input);
  if (!parsed) {
    setHelp('Enter a public GitHub repo URL or owner/repo, for example vercel/next.js.', true);
    return false;
  }

  setHelp('Reading public GitHub signals. No private data is requested.', false);
  document.querySelector('.hero').classList.add('hidden');
  els.results.classList.add('hidden');
  els.status.classList.remove('hidden');

  try {
    const analysis = await analyzeRepo(parsed.owner, parsed.repo);
    renderAnalysis(analysis);
    if (writeUrl) updateUrl(parsed.owner, parsed.repo, { replace: replaceUrl });
    if (scrollToResults) els.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  } catch (error) {
    setHelp(error.message || 'Unable to analyze this repo. Try another public repository.', true);
    document.querySelector('.hero').classList.remove('hidden');
    return false;
  } finally {
    els.status.classList.add('hidden');
  }
}

function setHelp(message, isError) {
  els.help.textContent = message;
  els.help.classList.toggle('error', Boolean(isError));
}

function showHome({ focusInput = false, clearUrl = false } = {}) {
  state.currentAnalysis = null;
  els.results.classList.add('hidden');
  els.status.classList.add('hidden');
  document.querySelector('.hero').classList.remove('hidden');
  restoreHomeMeta();
  if (clearUrl) clearRepoUrl();
  if (focusInput) els.input.focus();
}

function getRepoFromUrl() {
  const pathRepo = parseRepoPath(location.pathname);
  if (pathRepo) return { value: `${pathRepo.owner}/${pathRepo.repo}`, source: 'path' };

  const queryRepo = new URLSearchParams(location.search).get('repo');
  const parsedQuery = parseRepoInput(queryRepo);
  return parsedQuery ? { value: `${parsedQuery.owner}/${parsedQuery.repo}`, source: 'query' } : null;
}

function parseRepoPath(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 3 || parts[0] !== 'repo') return null;
  try {
    return parseRepoInput(`${decodeURIComponent(parts[1])}/${decodeURIComponent(parts[2])}`);
  } catch {
    return null;
  }
}

function parseRepoInput(input) {
  if (!input || !input.trim()) return null;
  let raw = input.trim();
  const short = raw.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (short) return { owner: short[1], repo: short[2] };
  try {
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const url = new URL(raw);
    if (!url.hostname.endsWith('github.com')) return null;
    const [owner, repoPart] = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    const repo = repoPart?.replace(/\.git$/i, '');
    return owner && repo ? { owner, repo } : null;
  } catch {
    return null;
  }
}

async function gh(path, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', ...(options.headers || {}) },
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error('GitHub rate limit reached. Try again later or use a smaller repo.');
    if (response.status === 404) throw new Error('Repository not found or not public.');
    throw new Error(`GitHub returned ${response.status}.`);
  }
  return response.json();
}

async function fetchText(owner, repo, path, branch) {
  try {
    const item = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
    if (!item.content) return null;
    const text = atob(item.content.replace(/\n/g, ''));
    return text.slice(0, 16000);
  } catch {
    return null;
  }
}

async function analyzeRepo(owner, repo) {
  els.statusMessage.textContent = 'Fetching repository metadata.';
  const meta = await gh(`/repos/${owner}/${repo}`);

  els.statusMessage.textContent = 'Reading languages and repository tree.';
  const [languages, treeResult] = await Promise.all([
    gh(`/repos/${owner}/${repo}/languages`).catch(() => ({})),
    gh(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`).catch(() => ({ tree: [], truncated: true })),
  ]);

  const paths = (treeResult.tree || []).map((item) => item.path);
  const findPath = (target) => paths.find((path) => path.toLowerCase() === target.toLowerCase());
  const readmePath = paths.find((path) => /^readme(\.[\w-]+)?$/i.test(path));
  const packagePath = findPath('package.json');
  const pyProjectPath = findPath('pyproject.toml');
  const requirementsPath = findPath('requirements.txt');
  const cargoPath = findPath('Cargo.toml');
  const goModPath = findPath('go.mod');

  els.statusMessage.textContent = 'Reading detected README and manifest files.';
  const [readme, pkg, pyProject, requirements, cargo, goMod] = await Promise.all([
    readmePath ? fetchText(owner, repo, readmePath, meta.default_branch) : Promise.resolve(null),
    packagePath ? fetchText(owner, repo, packagePath, meta.default_branch) : Promise.resolve(null),
    pyProjectPath ? fetchText(owner, repo, pyProjectPath, meta.default_branch) : Promise.resolve(null),
    requirementsPath ? fetchText(owner, repo, requirementsPath, meta.default_branch) : Promise.resolve(null),
    cargoPath ? fetchText(owner, repo, cargoPath, meta.default_branch) : Promise.resolve(null),
    goModPath ? fetchText(owner, repo, goModPath, meta.default_branch) : Promise.resolve(null),
  ]);
  const packageJson = parseJson(pkg);
  const stack = detectStack({ languages, packageJson, pyProject, requirements, cargo, goMod, paths });
  const daysSincePush = daysAgo(meta.pushed_at);
  const hasReadme = Boolean(readme && readme.trim().length > 120);
  const hasTests = paths.some((path) => /(^|\/)(test|tests|__tests__|spec)\b/i.test(path)) || Boolean(packageJson?.scripts?.test);
  const hasCI = paths.some((path) => path.startsWith('.github/workflows/'));
  const hasLicense = Boolean(meta.license?.spdx_id) || paths.some((path) => /^licen[cs]e/i.test(path));
  const deps = getDependencies(packageJson);
  const risks = buildRisks({ hasReadme, hasTests, hasCI, hasLicense, packageJson, daysSincePush, openIssues: meta.open_issues_count });
  const opportunities = buildOpportunities({ hasReadme, hasTests, hasCI, stars: meta.stargazers_count, stack });
  const scorecard = buildScorecard({ hasReadme, hasTests, hasCI, hasLicense, stars: meta.stargazers_count, daysSincePush, openIssues: meta.open_issues_count, stack });
  const verdict = buildVerdict(scorecard, risks);
  const complexity = buildComplexity(paths);
  const howToUse = buildHowToUse({ owner, repo, packageJson, paths, hasReadme, hasTests, stack });
  els.statusMessage.textContent = 'Finding related public repositories.';
  const relatedRepos = await findRelatedRepos({ owner, repo, meta, languages }).catch(() => []);

  return {
    owner,
    repo,
    source: treeResult.truncated ? 'Live GitHub data, partial tree' : 'Live GitHub data',
    url: meta.html_url,
    meta,
    languages,
    stack,
    deps,
    risks,
    opportunities,
    scorecard,
    verdict,
    complexity,
    howToUse,
    relatedRepos,
    prompts: buildPrompts(owner, repo, primaryLanguage(languages, meta.language)),
    evidence: buildEvidence({ meta, paths, hasReadme, packageJson, hasTests, hasCI, hasLicense }),
    summary: buildSummary(meta, stack, hasReadme),
  };
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function findRelatedRepos({ owner, repo, meta, languages }) {
  const language = primaryLanguage(languages, meta.language);
  const topics = Array.isArray(meta.topics) ? meta.topics : [];
  const topicTerms = topics.slice(0, 2).map((topic) => githubQualifier('topic', topic)).filter(Boolean);
  const keywordTerms = extractRepoKeywords(`${repo} ${meta.description || ''}`).slice(0, topicTerms.length ? 1 : 3);
  const languageTerm = language && language !== 'Unknown' ? githubQualifier('language', language) : '';
  const queryParts = [
    ...topicTerms,
    languageTerm,
    ...keywordTerms,
    'stars:>50',
  ].filter(Boolean);
  const fallbackQuery = [repo, languageTerm, 'stars:>50'].filter(Boolean);
  const params = new URLSearchParams({
    q: (queryParts.length >= 2 ? queryParts : fallbackQuery).join(' '),
    sort: 'stars',
    order: 'desc',
    per_page: '8',
  });
  const result = await gh(`/search/repositories?${params.toString()}`);
  return (result.items || [])
    .filter((item) => item?.full_name && item.owner?.login)
    .filter((item) => item.owner.login.toLowerCase() !== owner.toLowerCase() || item.name.toLowerCase() !== repo.toLowerCase())
    .slice(0, 4)
    .map((item) => ({
      owner: item.owner.login,
      repo: item.name,
      fullName: item.full_name,
      description: item.description || 'No public description available.',
      stars: item.stargazers_count || 0,
      language: item.language || 'Unknown',
      url: item.html_url,
      briefUrl: buildRepoUrl(item.owner.login, item.name).pathname,
    }));
}

function githubQualifier(name, value) {
  const cleaned = String(value || '').trim().replace(/[^\w.+#-]/g, '');
  return cleaned ? `${name}:${cleaned}` : '';
}

function extractRepoKeywords(text) {
  const stopWords = new Set(['about', 'after', 'also', 'from', 'into', 'like', 'that', 'this', 'with', 'your', 'github', 'repo', 'repository', 'project', 'tool', 'library']);
  const seen = new Set();
  return String(text || '')
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{3,}/g)
    ?.filter((word) => !stopWords.has(word))
    .filter((word) => {
      if (seen.has(word)) return false;
      seen.add(word);
      return true;
    }) || [];
}

function primaryLanguage(languages, fallback) {
  const entries = Object.entries(languages || {});
  if (!entries.length) return fallback || 'the primary language';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function detectStack({ languages, packageJson, pyProject, requirements, cargo, goMod, paths }) {
  const stack = [];
  const add = (name, category, evidence, confidence = 0.85) => {
    if (!stack.some((item) => item.name === name)) stack.push({ name, category, evidence, confidence });
  };

  Object.keys(languages || {}).slice(0, 5).forEach((language) => add(language, 'language', 'GitHub languages', 0.92));
  if (packageJson) add('Node.js', 'runtime', 'package.json', 0.95);
  if (pyProject || requirements) add('Python', 'language', pyProject ? 'pyproject.toml' : 'requirements.txt', 0.9);
  if (cargo) add('Rust', 'language', 'Cargo.toml', 0.95);
  if (goMod) add('Go', 'language', 'go.mod', 0.95);
  if (paths.some((path) => /^Dockerfile|docker-compose/i.test(path))) add('Docker', 'infra', 'Docker config', 0.9);
  if (paths.some((path) => path.startsWith('.github/workflows/'))) add('GitHub Actions', 'infra', '.github/workflows', 0.9);
  if (paths.includes('vercel.json')) add('Vercel', 'infra', 'vercel.json', 0.9);

  const allDeps = { ...(packageJson?.dependencies || {}), ...(packageJson?.devDependencies || {}) };
  const hints = [
    ['next', 'Next.js', 'framework'],
    ['react', 'React', 'framework'],
    ['vue', 'Vue', 'framework'],
    ['svelte', 'Svelte', 'framework'],
    ['express', 'Express', 'framework'],
    ['fastify', 'Fastify', 'framework'],
    ['vite', 'Vite', 'tooling'],
    ['tailwindcss', 'Tailwind CSS', 'framework'],
    ['typescript', 'TypeScript', 'language'],
    ['prisma', 'Prisma', 'data'],
    ['drizzle-orm', 'Drizzle ORM', 'data'],
    ['openai', 'OpenAI', 'ai'],
    ['@anthropic-ai/sdk', 'Anthropic', 'ai'],
    ['langchain', 'LangChain', 'ai'],
  ];
  hints.forEach(([dep, name, category]) => {
    if (allDeps[dep]) add(name, category, `${dep}@${allDeps[dep]}`, 0.9);
  });

  return stack.slice(0, 12);
}

function getDependencies(packageJson) {
  const runtime = Object.entries(packageJson?.dependencies || {}).map(([name, version]) => ({ name, version }));
  const dev = Object.entries(packageJson?.devDependencies || {}).map(([name, version]) => ({ name, version }));
  return { runtime, dev };
}

function daysAgo(iso) {
  if (!iso) return 9999;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function buildSummary(meta, stack, hasReadme) {
  const stackNames = stack.slice(0, 4).map((item) => item.name);
  const noun = meta.description || `${meta.full_name} is a public GitHub repository.`;
  return {
    headline: `${meta.full_name} looks like ${stackNames.length ? `a ${stackNames.join(' + ')} project` : 'a software project'} with ${formatNumber(meta.stargazers_count)} stars.`,
    purpose: noun,
    audience: meta.topics?.length ? `Builders interested in ${meta.topics.slice(0, 4).join(', ')}.` : 'Developers evaluating whether this repo is worth studying, using, or forking.',
    pitch: hasReadme ? 'README and manifest signals are available, so first-pass onboarding should be practical.' : 'Public metadata is available, but the README signal looks thin, so inspect source before trusting the repo.',
  };
}

function buildRisks({ hasReadme, hasTests, hasCI, hasLicense, packageJson, daysSincePush, openIssues }) {
  const risks = [];
  if (!hasReadme) risks.push(risk('README is thin or missing', 'Docs', 3, 'A weak README slows onboarding and makes setup assumptions harder to verify.'));
  if (!hasTests) risks.push(risk('No obvious test suite', 'Testing', 4, 'No test folder or test script was detected from the public tree.'));
  if (!hasCI) risks.push(risk('No CI detected', 'Maintenance', 3, 'No GitHub Actions workflow was visible in the scanned tree.'));
  if (!hasLicense) risks.push(risk('License unclear', 'Licensing', 4, 'Without a clear license, reuse and commercial adoption are risky.'));
  if (packageJson) risks.push(risk('Dependency audit needed', 'Security', 3, 'Node projects can inherit supply-chain and transitive dependency risk.'));
  if (daysSincePush > 180) risks.push(risk('Maintenance may be stale', 'Maintenance', 3, `Last push appears to be ${daysSincePush} days ago.`));
  if (openIssues > 100) risks.push(risk('Large issue backlog', 'Maintenance', 2, `${openIssues} open issues may indicate support or quality pressure.`));
  return risks.slice(0, 5);
}

function risk(title, area, severity, rationale) {
  return { title, area, severity, rationale };
}

function buildOpportunities({ hasReadme, hasTests, hasCI, stars, stack }) {
  const opportunities = [
    { title: 'Create a 24-hour contributor guide', area: 'Docs', upside: 5, effort: 2, rationale: 'A short path from clone to first change reduces friction immediately.' },
    { title: 'Add AI-friendly architecture notes', area: 'AI', upside: 4, effort: 2, rationale: 'A map of entry points, modules, and conventions improves coding-agent results.' },
  ];
  if (!hasTests) opportunities.push({ title: 'Add smoke tests first', area: 'Quality', upside: 4, effort: 3, rationale: 'Small tests protect future refactors and integrations.' });
  if (!hasCI) opportunities.push({ title: 'Add a minimal CI workflow', area: 'DX', upside: 3, effort: 2, rationale: 'Automated checks stop broken pushes from becoming releases.' });
  if (stars > 100) opportunities.push({ title: 'Package a hosted version', area: 'Growth', upside: 4, effort: 4, rationale: 'Public traction suggests possible demand for a managed or hosted layer.' });
  if (stack.some((item) => item.category === 'ai')) opportunities.push({ title: 'Document model and prompt boundaries', area: 'AI', upside: 4, effort: 2, rationale: 'AI projects need clear cost, privacy, and evaluation guidance.' });
  if (!hasReadme) opportunities.push({ title: 'Rewrite README above all else', area: 'Growth', upside: 5, effort: 2, rationale: 'The README is the landing page for most repos.' });
  return opportunities.slice(0, 5);
}

function buildScorecard({ hasReadme, hasTests, hasCI, hasLicense, stars, daysSincePush, openIssues, stack }) {
  const adoption = stars >= 10000 ? 10 : stars >= 1000 ? 8 : stars >= 100 ? 6 : stars >= 25 ? 4 : 2;
  const maintenance = clamp((daysSincePush <= 14 ? 9 : daysSincePush <= 60 ? 7 : daysSincePush <= 180 ? 5 : 3) - (openIssues > 500 ? 1 : 0), 1, 10);
  return [
    score('Maintenance', maintenance, daysSincePush <= 60 ? 'Recent activity suggests maintainers are present.' : 'Check whether the project is still actively maintained.'),
    score('Documentation', clamp((hasReadme ? 7 : 3) + (hasLicense ? 1 : 0), 1, 10), hasReadme ? 'README detected.' : 'README signal is weak.'),
    score('Setup clarity', clamp((hasReadme ? 4 : 1) + Math.min(stack.length, 4), 1, 10), `${stack.length} stack signals detected.`),
    score('Test confidence', clamp((hasTests ? 7 : 3) + (hasCI ? 2 : 0), 1, 10), hasTests ? 'Tests or test scripts detected.' : 'No clear tests detected.'),
    score('Adoption signal', adoption, `${formatNumber(stars)} stars found.`),
  ];
}

function score(label, value, reason) {
  return { label, value, reason };
}

function buildVerdict(scorecard, risks) {
  const avg = scorecard.reduce((sum, item) => sum + item.value, 0) / scorecard.length;
  const serious = risks.some((item) => item.severity >= 4);
  if (avg >= 7 && !serious) return { label: 'Likely safe to explore or adopt', tone: 'Adopt', rationale: 'The public signals look healthy enough for deeper evaluation.' };
  if (avg >= 5) return { label: 'Good to study, verify before adopting', tone: 'Study', rationale: 'There is useful signal here, but some operational questions need checking first.' };
  return { label: 'Investigate before relying on it', tone: 'Investigate', rationale: 'The repo needs manual review before serious use.' };
}

function buildHowToUse({ owner, repo, packageJson, paths, hasReadme, hasTests, stack }) {
  const packageManager = paths.includes('pnpm-lock.yaml') ? 'pnpm' : paths.includes('yarn.lock') ? 'yarn' : 'npm';
  const script = (names) => names.find((name) => packageJson?.scripts?.[name]);
  const runScript = script(['dev', 'start', 'serve', 'preview']);
  const testScript = script(['test', 'check', 'lint']);
  const primaryArea = ['src/', 'app/', 'pages/', 'client/', 'server/', 'packages/'].find((dir) => paths.some((path) => path.startsWith(dir))) || 'README.md';
  const steps = [
    { title: 'Read the promise', action: hasReadme ? 'Start with README.md and compare the promise to the detected file tree.' : 'README signal is weak, so treat the file tree as the first map.', command: null },
    { title: 'Clone locally', action: 'Pull the repo down before asking an AI tool to modify it.', command: `git clone https://github.com/${owner}/${repo}.git && cd ${repo}` },
  ];
  if (packageJson) steps.push({ title: 'Install dependencies', action: 'Install the Node dependency graph using the detected lockfile style where possible.', command: `${packageManager} install` });
  if (runScript) steps.push({ title: 'Run the app', action: 'Start the detected app script, then open the URL printed in the terminal.', command: `${packageManager} ${runScript === 'start' ? 'start' : `run ${runScript}`}` });
  steps.push({ title: 'Trace the main area', action: `Begin in ${primaryArea}. Follow imports or route handlers before editing.`, command: null });
  if (testScript || hasTests) steps.push({ title: 'Check behavior', action: hasTests ? 'Run the tests before and after changes.' : 'No test suite was obvious, so run the closest quality command and add a smoke test.', command: testScript ? `${packageManager} ${testScript === 'test' ? 'test' : `run ${testScript}`}` : null });
  steps.push({ title: 'Use the prompt board', action: 'Copy one prompt below into your coding assistant with the repo open.', command: null });
  return steps;
}

function buildComplexity(paths) {
  const counts = new Map();
  paths.filter((path) => !path.endsWith('/')).forEach((path) => {
    const root = path.includes('/') ? path.split('/')[0] : '(root)';
    if (['.git', 'node_modules', 'dist', 'build'].includes(root)) return;
    counts.set(root, (counts.get(root) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({
    name,
    count,
    level: count > 80 ? 'high' : count > 25 ? 'medium' : 'low',
  }));
}

function buildPrompts(owner, repo, language) {
  const slug = `${owner}/${repo}`;
  return [
    ['Understand', '30-second briefing', `Read the README and main source files of ${slug}. Explain what it does, who it is for, core abstractions, entry points, and one non-obvious design choice.`],
    ['Onboard', 'Directory tour', `Act as a senior engineer onboarding me to ${slug}. Walk the tree top-down and tell me what to read first.`],
    ['Extend', 'Feature plan', `I want to add <FEATURE> to ${slug}. List files to edit, files to create, data changes, risks, and a minimal implementation plan.`],
    ['Refactor', 'Hotspot plan', `Identify the 3 most fragile modules in ${slug}. Propose safe refactors, tests needed, and rank them by ROI.`],
    ['Test', 'Test pyramid', `Design a test strategy for ${slug}. Include unit, integration, e2e, and 5 example tests in ${language}.`],
    ['Document', 'Missing docs', `Generate CONTRIBUTING.md, architecture notes, and a first-24-hours guide for new contributors to ${slug}.`],
  ];
}

function buildEvidence({ meta, paths, hasReadme, packageJson, hasTests, hasCI, hasLicense }) {
  return [
    ['Repository metadata', meta.full_name, `${formatNumber(meta.stargazers_count)} stars, ${formatNumber(meta.forks_count)} forks, ${meta.open_issues_count} open issues.`],
    ['README', 'README.md', hasReadme ? 'Detected and used as an onboarding signal.' : 'Missing or too thin in public API scan.'],
    ['Manifest', 'package.json', packageJson ? 'Detected and used for stack/dependency clues.' : 'No package.json detected at repo root.'],
    ['Testing', 'test paths / scripts', hasTests ? 'Tests or test scripts detected.' : 'No clear tests detected.'],
    ['CI', '.github/workflows', hasCI ? 'GitHub Actions workflow detected.' : 'No GitHub Actions workflow detected.'],
    ['License', 'license metadata', hasLicense ? 'License signal detected.' : 'No clear license signal detected.'],
    ['Tree size', 'git tree', `${paths.length} public tree paths scanned.`],
  ];
}

function renderAnalysis(data) {
  state.currentAnalysis = data;
  els.results.classList.remove('hidden');
  els.resultSource.textContent = data.source;
  els.title.textContent = `${data.owner}/${data.repo}`;
  els.headline.textContent = data.summary.headline;
  els.githubLink.href = data.url;
  updateRepoMeta(data);
  els.purpose.textContent = data.summary.purpose;
  els.audience.textContent = data.summary.audience;
  els.pitch.textContent = data.summary.pitch;
  els.verdictLabel.textContent = data.verdict.label;
  els.verdictRationale.textContent = data.verdict.rationale;

  els.metricGrid.innerHTML = [
    ['Stars', formatNumber(data.meta.stargazers_count)],
    ['Forks', formatNumber(data.meta.forks_count)],
    ['Issues', formatNumber(data.meta.open_issues_count)],
    ['Language', primaryLanguage(data.languages, data.meta.language)],
    ['Last push', relativeTime(data.meta.pushed_at)],
  ].map(([label, value]) => `<div class="metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('');

  els.verdictList.innerHTML = data.risks.slice(0, 3).map((item) => `<li>${escapeHtml(item.title)}</li>`).join('');
  els.scorecard.innerHTML = data.scorecard.map((item) => `
    <div class="score-row">
      <strong>${escapeHtml(item.label)} · ${item.value}/10</strong>
      <div class="score-bar"><span style="width:${item.value * 10}%"></span></div>
      <p>${escapeHtml(item.reason)}</p>
    </div>`).join('');

  els.howToUse.innerHTML = data.howToUse.map((step, index) => `
    <div class="step">
      <strong>${index + 1}. ${escapeHtml(step.title)}</strong>
      <p>${escapeHtml(step.action)}</p>
      ${step.command ? `<code>${escapeHtml(step.command)}</code>` : ''}
    </div>`).join('');

  els.techStack.innerHTML = data.stack.length
    ? data.stack.map((item) => `<span class="chip" title="${escapeHtml(item.evidence)}">${escapeHtml(item.name)} · ${escapeHtml(item.category)}</span>`).join('')
    : '<p class="muted">No strong stack signals detected from public metadata.</p>';

  const runtimeCount = data.deps.runtime.length;
  const devCount = data.deps.dev.length;
  els.depSummary.innerHTML = `
    <div class="mini-item"><strong>${runtimeCount}</strong><p>runtime dependencies</p></div>
    <div class="mini-item"><strong>${devCount}</strong><p>development dependencies</p></div>
    <p class="muted">Run a dedicated audit before production adoption. This browser utility only highlights visible dependency shape.</p>`;

  els.architectureMap.innerHTML = renderArchitecture(data);
  els.complexityMap.innerHTML = data.complexity.length
    ? data.complexity.map((item) => `<div class="tree-cell" style="--weight:${Math.min(item.count, 80)}"><strong>${escapeHtml(item.name)}</strong><p>${item.count} files · ${item.level}</p></div>`).join('')
    : '<p class="muted">No tree data available.</p>';

  els.risks.innerHTML = data.risks.map((item) => `<div class="risk-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.area)} · severity ${item.severity}/5</p><p>${escapeHtml(item.rationale)}</p></div>`).join('');
  els.opportunities.innerHTML = data.opportunities.map((item) => `<div class="opp-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.area)} · upside ${item.upside}/5 · effort ${item.effort}/5</p><p>${escapeHtml(item.rationale)}</p></div>`).join('');
  els.promptBoard.innerHTML = data.prompts.map(([category, title, prompt]) => `
    <div class="prompt-card">
      <small>${escapeHtml(category)}</small>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(prompt)}</p>
      <button type="button" data-copy="${escapeAttr(prompt)}">Copy prompt</button>
    </div>`).join('');
  els.evidence.innerHTML = data.evidence.map(([label, path, note]) => `<div class="evidence-item"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(path)}</p><p>${escapeHtml(note)}</p></div>`).join('');
  els.relatedRepos.innerHTML = renderRelatedRepos(data.relatedRepos);
  resetFeedback();
  updateFeedbackIssueLink();

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await copyText(button.dataset.copy);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Copy failed';
      }
      setTimeout(() => { button.textContent = 'Copy prompt'; }, 1200);
    });
  });
}

function renderRelatedRepos(repos) {
  if (!repos.length) {
    return '<p class="muted">No strong related repo signal was available from the public GitHub search API. Try scanning a repo with clearer topics, language, or description.</p>';
  }

  return repos.map((repo) => `\n    <article class="related-card">\n      <div>\n        <small>${escapeHtml(repo.language)} · ${formatNumber(repo.stars)} stars</small>\n        <strong>${escapeHtml(repo.fullName)}</strong>\n        <p>${escapeHtml(repo.description)}</p>\n      </div>\n      <div class="related-actions">\n        <a class="secondary-button" href="${escapeAttr(repo.briefUrl)}">Brief this repo</a>\n        <a class="text-button" href="${escapeAttr(repo.url)}" target="_blank" rel="noreferrer noopener">GitHub</a>\n      </div>\n    </article>`).join('');
}

function selectedFeedbackTone() {
  return document.querySelector('input[name="tone"]:checked')?.value || 'Useful';
}

function resetFeedback() {
  els.feedbackMessage.value = '';
  const usefulOption = document.querySelector('input[name="tone"][value="Useful"]');
  if (usefulOption) usefulOption.checked = true;
  els.feedbackStatus.textContent = 'Opens a prefilled public GitHub issue. You choose whether to submit it.';
}

function buildFeedbackBody() {
  const data = state.currentAnalysis;
  const slug = data ? `${data.owner}/${data.repo}` : 'unknown repo';
  const message = els.feedbackMessage.value.trim() || '(No extra notes provided.)';

  return [
    `Repo: ${slug}`,
    `SourceBrief URL: ${location.href}`,
    `GitHub URL: ${data?.url || 'n/a'}`,
    `Feedback type: ${selectedFeedbackTone()}`,
    '',
    'Feedback:',
    message,
    '',
    'Context:',
    `Verdict: ${data?.verdict?.label || 'n/a'}`,
    `Headline: ${data?.summary?.headline || 'n/a'}`,
  ].join('\n');
}

function buildFeedbackIssueUrl() {
  const data = state.currentAnalysis;
  const slug = data ? `${data.owner}/${data.repo}` : 'SourceBrief result';
  const url = new URL(FEEDBACK_ISSUE_URL);
  url.searchParams.set('title', `[SourceBrief feedback] ${selectedFeedbackTone()}: ${slug}`);
  url.searchParams.set('body', buildFeedbackBody());
  return url.href;
}

function updateFeedbackIssueLink() {
  els.feedbackIssueLink.href = buildFeedbackIssueUrl();
  if (!els.feedbackStatus.textContent.includes('copied')) {
    els.feedbackStatus.textContent = 'Opens a prefilled public GitHub issue. You choose whether to submit it.';
  }
}

function renderArchitecture(data) {
  const nodes = [
    ['user', 'User'],
    ['repo', 'GitHub repo'],
    ['stack', 'Stack signals'],
    ['risk', 'Risk layer'],
    ['brief', 'Source brief'],
  ];
  if (data.deps.runtime.length) nodes.splice(3, 0, ['deps', 'Dependencies']);
  const positions = {
    user: [55, 120],
    repo: [190, 75],
    stack: [340, 75],
    deps: [340, 165],
    risk: [500, 165],
    brief: [650, 120],
  };
  const edges = data.deps.runtime.length
    ? [['user', 'repo'], ['repo', 'stack'], ['repo', 'deps'], ['stack', 'brief'], ['deps', 'risk'], ['risk', 'brief']]
    : [['user', 'repo'], ['repo', 'stack'], ['repo', 'risk'], ['stack', 'brief'], ['risk', 'brief']];
  return `<svg viewBox="0 0 720 240" role="img" aria-label="Architecture map">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"></path></marker></defs>
    ${edges.map(([a, b]) => {
      if (!positions[a] || !positions[b]) return '';
      const [x1, y1] = positions[a];
      const [x2, y2] = positions[b];
      return `<path d="M${x1 + 54} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2 - 54} ${y2}" stroke="var(--muted)" stroke-width="1.5" fill="none" marker-end="url(#arrow)" opacity=".7"></path>`;
    }).join('')}
    ${nodes.map(([id, label]) => {
      const [x, y] = positions[id];
      return `<g transform="translate(${x - 54} ${y - 24})"><rect width="108" height="48" rx="14" fill="var(--surface-2)" stroke="var(--border)"></rect><text x="54" y="29" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700">${escapeHtml(label)}</text></g>`;
    }).join('')}
  </svg>`;
}

function updateUrl(owner, repo, options = {}) {
  const url = buildRepoUrl(owner, repo);
  const method = options.replace ? 'replaceState' : 'pushState';
  history[method]({ repo: `${owner}/${repo}` }, '', url);
}

function clearRepoUrl() {
  history.pushState({}, '', new URL('/', location.origin));
  restoreHomeMeta();
}

function buildRepoUrl(owner, repo) {
  return new URL(`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/`, location.origin);
}

function updateRepoMeta(data) {
  const slug = `${data.owner}/${data.repo}`;
  const canonical = buildRepoUrl(data.owner, data.repo).href;
  const language = primaryLanguage(data.languages, data.meta.language);
  const baseDescription = data.meta.description || data.summary.headline || 'Public GitHub repository briefing';
  const title = truncateText(`${slug} GitHub Repo Brief | SourceBrief`, 60);
  const description = truncateText(
    `GitHub repo briefing for ${slug}: ${baseDescription} See stack, setup clues, safety signals, risks, and AI prompts.`,
    155,
  );

  document.title = title;
  setMeta(meta.description, 'content', description);
  setMeta(meta.canonical, 'href', canonical);
  setMeta(meta.ogTitle, 'content', title);
  setMeta(meta.ogDescription, 'content', description);
  setMeta(meta.ogUrl, 'content', canonical);
  upsertRepoJsonLd({
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${slug} GitHub Repo Brief`,
    description,
    url: canonical,
    about: {
      '@type': 'SoftwareSourceCode',
      name: slug,
      codeRepository: data.url,
      programmingLanguage: language,
    },
    isPartOf: {
      '@type': 'WebSite',
      name: 'SourceBrief',
      url: HOME_URL,
    },
  });
}

function restoreHomeMeta() {
  document.title = homeMeta.title;
  setMeta(meta.description, 'content', homeMeta.description);
  setMeta(meta.canonical, 'href', homeMeta.canonical);
  setMeta(meta.ogTitle, 'content', homeMeta.ogTitle);
  setMeta(meta.ogDescription, 'content', homeMeta.ogDescription);
  setMeta(meta.ogUrl, 'content', homeMeta.ogUrl);
  document.querySelector('#repo-brief-jsonld')?.remove();
}

function setMeta(element, attribute, value) {
  if (element) element.setAttribute(attribute, value);
}

function upsertRepoJsonLd(data) {
  let script = document.querySelector('#repo-brief-jsonld');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'repo-brief-jsonld';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

function formatNumber(number) {
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number ?? 0);
}

function relativeTime(iso) {
  const days = daysAgo(iso);
  if (days === 0) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
