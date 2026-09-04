/**
 * Repo intelligence engine.
 * Tries the public GitHub REST API first (no auth required for public repos).
 * Falls back to a deterministic simulated analysis on rate limit / 404 / network failure.
 */

import type {
  RepoAnalysis,
  TechStackItem,
  ArchitectureNode,
  ArchitectureEdge,
  ComplexityModule,
  DependencyEdge,
  RiskItem,
  OpportunityItem,
  PromptCard,
  HowToUseStep,
  RepoVerdict,
  ScorecardItem,
  EvidenceItem,
} from "@shared/schema";

const GITHUB_API = "https://api.github.com";

const UA = { "User-Agent": "SourceBrief/1.0 (+https://sourcebrief.dev)", "Accept": "application/vnd.github+json" };

export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  let raw = input.trim();
  // owner/repo
  const slash = raw.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (slash) return { owner: slash[1], repo: slash[2] };
  // url forms
  try {
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    const u = new URL(raw);
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

async function ghFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...UA, ...(init?.headers || {}) },
  });
  return res;
}

async function safeJson<T = any>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type GHRepo = {
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  subscribers_count?: number;
  watchers_count: number;
  open_issues_count: number;
  license?: { spdx_id: string | null; name: string | null } | null;
  language: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  topics?: string[];
  size: number;
  homepage: string | null;
  full_name: string;
};

type GHTreeItem = { path: string; type: string; size?: number };
type GHTree = { tree: GHTreeItem[]; truncated: boolean };

const FRAMEWORK_HINTS: Array<{ deps: string[]; name: string; category: TechStackItem["category"] }> = [
  { deps: ["next"], name: "Next.js", category: "framework" },
  { deps: ["nuxt"], name: "Nuxt", category: "framework" },
  { deps: ["@remix-run/react", "@remix-run/node"], name: "Remix", category: "framework" },
  { deps: ["@sveltejs/kit"], name: "SvelteKit", category: "framework" },
  { deps: ["astro"], name: "Astro", category: "framework" },
  { deps: ["react"], name: "React", category: "framework" },
  { deps: ["vue"], name: "Vue", category: "framework" },
  { deps: ["svelte"], name: "Svelte", category: "framework" },
  { deps: ["solid-js"], name: "Solid", category: "framework" },
  { deps: ["express"], name: "Express", category: "framework" },
  { deps: ["fastify"], name: "Fastify", category: "framework" },
  { deps: ["hono"], name: "Hono", category: "framework" },
  { deps: ["@nestjs/core"], name: "NestJS", category: "framework" },
  { deps: ["vite"], name: "Vite", category: "tooling" },
  { deps: ["webpack"], name: "Webpack", category: "tooling" },
  { deps: ["turbo"], name: "Turborepo", category: "tooling" },
  { deps: ["tailwindcss"], name: "Tailwind CSS", category: "framework" },
  { deps: ["typescript"], name: "TypeScript", category: "language" },
  { deps: ["prisma", "@prisma/client"], name: "Prisma", category: "data" },
  { deps: ["drizzle-orm"], name: "Drizzle ORM", category: "data" },
  { deps: ["mongoose"], name: "MongoDB / Mongoose", category: "data" },
  { deps: ["pg"], name: "PostgreSQL", category: "data" },
  { deps: ["redis", "ioredis"], name: "Redis", category: "data" },
  { deps: ["better-sqlite3"], name: "SQLite", category: "data" },
  { deps: ["openai"], name: "OpenAI", category: "ai" },
  { deps: ["@anthropic-ai/sdk"], name: "Anthropic", category: "ai" },
  { deps: ["langchain", "@langchain/core"], name: "LangChain", category: "ai" },
  { deps: ["ai"], name: "Vercel AI SDK", category: "ai" },
];

function detectFromManifests(opts: {
  pkgJson?: any;
  pyProject?: string;
  reqTxt?: string;
  cargoToml?: string;
  goMod?: string;
  gemfile?: string;
  composer?: any;
  hasDockerfile?: boolean;
  hasGitHubActions?: boolean;
  hasVercel?: boolean;
  paths: string[];
}): { stack: TechStackItem[]; runtimeDeps: { name: string; version?: string }[]; devDeps: { name: string; version?: string }[] } {
  const stack: TechStackItem[] = [];
  const runtimeDeps: { name: string; version?: string }[] = [];
  const devDeps: { name: string; version?: string }[] = [];

  if (opts.pkgJson) {
    stack.push({ name: "Node.js", category: "runtime", confidence: 0.95, evidence: "package.json present" });
    const deps = { ...(opts.pkgJson.dependencies || {}) } as Record<string, string>;
    const dev = { ...(opts.pkgJson.devDependencies || {}) } as Record<string, string>;
    Object.entries(deps).forEach(([k, v]) => runtimeDeps.push({ name: k, version: String(v) }));
    Object.entries(dev).forEach(([k, v]) => devDeps.push({ name: k, version: String(v) }));
    const all = { ...deps, ...dev };
    for (const hint of FRAMEWORK_HINTS) {
      const matched = hint.deps.find((d) => all[d] != null);
      if (matched) {
        stack.push({
          name: hint.name,
          category: hint.category,
          confidence: 0.9,
          evidence: `package.json: ${matched}@${all[matched]}`,
        });
      }
    }
  }
  if (opts.pyProject || opts.reqTxt) {
    stack.push({ name: "Python", category: "language", confidence: 0.95, evidence: opts.pyProject ? "pyproject.toml" : "requirements.txt" });
    const blob = `${opts.pyProject || ""}\n${opts.reqTxt || ""}`.toLowerCase();
    const pyHints: Array<[string, string, TechStackItem["category"]]> = [
      ["fastapi", "FastAPI", "framework"],
      ["django", "Django", "framework"],
      ["flask", "Flask", "framework"],
      ["torch", "PyTorch", "ai"],
      ["tensorflow", "TensorFlow", "ai"],
      ["transformers", "HuggingFace Transformers", "ai"],
      ["langchain", "LangChain", "ai"],
      ["pandas", "Pandas", "data"],
      ["numpy", "NumPy", "data"],
    ];
    for (const [needle, name, category] of pyHints) {
      if (blob.includes(needle)) {
        stack.push({ name, category, confidence: 0.8, evidence: `python deps include ${needle}` });
      }
    }
  }
  if (opts.cargoToml) {
    stack.push({ name: "Rust", category: "language", confidence: 0.98, evidence: "Cargo.toml" });
    if (/tokio/i.test(opts.cargoToml)) stack.push({ name: "Tokio", category: "framework", confidence: 0.8, evidence: "Cargo.toml: tokio" });
    if (/axum/i.test(opts.cargoToml)) stack.push({ name: "Axum", category: "framework", confidence: 0.8, evidence: "Cargo.toml: axum" });
  }
  if (opts.goMod) {
    stack.push({ name: "Go", category: "language", confidence: 0.98, evidence: "go.mod" });
    if (/gin-gonic\/gin/i.test(opts.goMod)) stack.push({ name: "Gin", category: "framework", confidence: 0.85, evidence: "go.mod: gin" });
  }
  if (opts.gemfile) stack.push({ name: "Ruby", category: "language", confidence: 0.95, evidence: "Gemfile" });
  if (opts.composer) stack.push({ name: "PHP", category: "language", confidence: 0.95, evidence: "composer.json" });
  if (opts.hasDockerfile) stack.push({ name: "Docker", category: "infra", confidence: 0.9, evidence: "Dockerfile" });
  if (opts.hasGitHubActions) stack.push({ name: "GitHub Actions", category: "infra", confidence: 0.9, evidence: ".github/workflows/*" });
  if (opts.hasVercel) stack.push({ name: "Vercel", category: "infra", confidence: 0.9, evidence: "vercel.json" });

  // Dedupe by name
  const seen = new Set<string>();
  const dedup = stack.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)));
  return { stack: dedup, runtimeDeps, devDeps };
}

function fileToModule(path: string): string {
  const parts = path.split("/");
  return parts[0] || path;
}

function inferModules(paths: string[]): ComplexityModule[] {
  const counts = new Map<string, number>();
  for (const p of paths) {
    if (!p) continue;
    const top = fileToModule(p);
    counts.set(top, (counts.get(top) || 0) + 1);
  }
  const arr = Array.from(counts.entries())
    .filter(([k]) => !/^(\.|LICENSE|README|node_modules|dist|build|\.git)/i.test(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  return arr.map(([name, size]) => {
    const complexity: ComplexityModule["complexity"] =
      size > 60 ? "high" : size > 20 ? "medium" : "low";
    return {
      name,
      path: name + "/",
      size,
      complexity,
      reason: `${size} files in ${name}/`,
    };
  });
}

function buildArchitecture(
  stack: TechStackItem[],
  paths: string[],
  owner: string,
  repo: string,
): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const tech = (n: string) => stack.some((s) => s.name === n);

  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];

  nodes.push({ id: "user", label: "User / Client", kind: "external" });

  if (has(/^(client|web|app|pages|src\/pages)\b/i) || tech("React") || tech("Next.js") || tech("Vue") || tech("Svelte")) {
    nodes.push({ id: "ui", label: "UI Layer", kind: "ui", description: tech("Next.js") ? "Next.js app" : tech("React") ? "React app" : "Frontend" });
    edges.push({ from: "user", to: "ui", kind: "control", label: "interacts" });
  }
  if (has(/^(server|api|backend|routes)\b/i) || tech("Express") || tech("Fastify") || tech("Hono") || tech("FastAPI") || tech("Django") || tech("Flask")) {
    nodes.push({ id: "api", label: "API / Server", kind: "service", description: "HTTP / REST routes" });
    if (nodes.find((n) => n.id === "ui")) edges.push({ from: "ui", to: "api", kind: "data", label: "fetch" });
    else edges.push({ from: "user", to: "api", kind: "control", label: "requests" });
  }
  if (tech("Prisma") || tech("Drizzle ORM") || tech("PostgreSQL") || tech("SQLite") || tech("MongoDB / Mongoose")) {
    nodes.push({ id: "db", label: "Database", kind: "data", description: stack.find((s) => s.category === "data")?.name });
    edges.push({ from: nodes.find((n) => n.id === "api") ? "api" : "ui", to: "db", kind: "data", label: "reads/writes" });
  }
  if (tech("Redis")) {
    nodes.push({ id: "cache", label: "Cache (Redis)", kind: "data" });
    edges.push({ from: "api", to: "cache", kind: "data", label: "cache" });
  }
  if (stack.some((s) => s.category === "ai")) {
    nodes.push({ id: "llm", label: "LLM / AI Provider", kind: "external", description: stack.filter((s) => s.category === "ai").map((s) => s.name).join(", ") });
    edges.push({ from: nodes.find((n) => n.id === "api") ? "api" : "ui", to: "llm", kind: "data", label: "prompt" });
  }
  if (tech("Docker") || tech("GitHub Actions") || tech("Vercel")) {
    nodes.push({ id: "ci", label: "CI / Deploy", kind: "module", description: [tech("GitHub Actions") && "GitHub Actions", tech("Docker") && "Docker", tech("Vercel") && "Vercel"].filter(Boolean).join(" · ") });
    edges.push({ from: "ci", to: nodes.find((n) => n.id === "api") ? "api" : "ui", kind: "depends", label: "ships" });
  }
  if (nodes.length <= 2) {
    // generic shape
    nodes.push({ id: "core", label: `${repo} core`, kind: "module" });
    edges.push({ from: "user", to: "core", kind: "control" });
  }
  return { nodes, edges };
}

function buildPrompts(owner: string, repo: string, primary: string | null): PromptCard[] {
  const slug = `${owner}/${repo}`;
  return [
    {
      category: "understand",
      title: "30-second briefing",
      prompt: `Read the README and main source files of ${slug}. In 5 bullets, explain what this repo does, who it's for, the core abstractions, the entry points, and one non-obvious design choice.`,
    },
    {
      category: "understand",
      title: "Onboarding tour",
      prompt: `Act as a senior engineer onboarding me to ${slug}. Walk me through the directory tree top-down. For each top-level folder, say (1) what lives there, (2) when I would touch it, (3) one file worth reading first.`,
    },
    {
      category: "extend",
      title: "Add a new feature",
      prompt: `I want to add <FEATURE> to ${slug}. List the files I'd need to modify, the new files I'd create, the data model changes, and the riskiest edge cases. Then output a minimal diff.`,
    },
    {
      category: "refactor",
      title: "Hotspot refactor plan",
      prompt: `Identify the 3 modules in ${slug} most likely to be tangled or fragile. For each, propose a refactor that preserves behavior, list the test coverage gaps it would expose, and rank by ROI.`,
    },
    {
      category: "test",
      title: "Generate a test pyramid",
      prompt: `Design a test strategy for ${slug}: unit, integration, e2e, performance. Specify which existing files need tests, which behaviors are currently untested, and produce 5 example tests in ${primary || "the primary language"}.`,
    },
    {
      category: "document",
      title: "Write the missing docs",
      prompt: `Generate (1) a concise CONTRIBUTING.md, (2) an architecture.md with a mermaid diagram derived from the source tree, and (3) a "first 24 hours" guide for new contributors to ${slug}.`,
    },
    {
      category: "market",
      title: "Landing page copy",
      prompt: `Write a homepage for ${slug}: a 7-word headline, 2-sentence subhead, 3 feature blocks (with icons), one social-proof block, and a closing CTA. Voice: confident, technical, no hype.`,
    },
    {
      category: "monetize",
      title: "Wedge a business model",
      prompt: `Given what ${slug} does, propose 3 viable monetization paths (OSS-core, hosted, marketplace, enterprise add-on, etc.). For each: target buyer, willingness to pay, GTM motion, and one experiment to validate in a week.`,
    },
  ];
}

function buildRisksAndOpps(opts: {
  pkgJson?: any;
  hasReadme: boolean;
  hasTests: boolean;
  hasCI: boolean;
  hasLicense: boolean;
  stars: number;
  daysSincePush: number;
  isDemo: boolean;
}): { risks: RiskItem[]; opportunities: OpportunityItem[] } {
  const risks: RiskItem[] = [];
  const opps: OpportunityItem[] = [];

  if (!opts.hasTests) {
    risks.push({
      title: "No detected test suite",
      area: "testing",
      severity: 4,
      impact: 4,
      rationale: "No tests/ or __tests__/ folder, and no test runner detected in deps. Regressions ship invisibly.",
    });
    opps.push({
      title: "Add a minimal test pyramid",
      area: "dx",
      upside: 4,
      effort: 3,
      rationale: "Even a small unit + smoke e2e suite raises confidence dramatically.",
    });
  }
  if (!opts.hasCI) {
    risks.push({
      title: "No CI detected",
      area: "maintenance",
      severity: 3,
      impact: 3,
      rationale: "No .github/workflows or CI config found. Builds and lints rely on local hygiene.",
    });
  }
  if (!opts.hasLicense) {
    risks.push({
      title: "Missing or unclear license",
      area: "licensing",
      severity: 4,
      impact: 5,
      rationale: "Without a clear license, downstream adopters cannot safely use or contribute.",
    });
  }
  if (!opts.hasReadme) {
    risks.push({
      title: "README is thin or missing",
      area: "docs",
      severity: 3,
      impact: 4,
      rationale: "First-impression docs determine 80% of OSS adoption.",
    });
    opps.push({
      title: "Rewrite the README in 5 sections",
      area: "growth",
      upside: 5,
      effort: 2,
      rationale: "What it is · Why care · 60-second demo · Install · Roadmap.",
    });
  }
  if (opts.daysSincePush > 180) {
    risks.push({
      title: "Repo appears stale",
      area: "maintenance",
      severity: 3,
      impact: 3,
      rationale: `Last push ${opts.daysSincePush} days ago. Dependencies and security patches likely drifted.`,
    });
  }
  if (opts.pkgJson) {
    risks.push({
      title: "Dependency audit recommended",
      area: "security",
      severity: 3,
      impact: 3,
      rationale: "Run `npm audit --omit=dev` and pin transitives. Lockfile drift is a common silent risk.",
    });
  }

  opps.push({
    title: "AI-assisted onboarding flow",
    area: "ai",
    upside: 4,
    effort: 2,
    rationale: "Wrap the README + tree into a 'ask the repo' chat to lower time-to-first-PR.",
  });
  opps.push({
    title: "Polished hero on GitHub social preview",
    area: "growth",
    upside: 3,
    effort: 1,
    rationale: "A clean OG image and tagline dramatically lifts star-through rate from links.",
  });
  if (opts.stars > 100) {
    opps.push({
      title: "Hosted tier or paid integration",
      area: "monetization",
      upside: 4,
      effort: 4,
      rationale: `${opts.stars}+ stars implies pull. A managed offering can capture organizations that won't self-host.`,
    });
  }
  return { risks, opportunities: opps };
}

function scriptCommand(pkgJson: any, preferred: string[]): string | undefined {
  const scripts = pkgJson?.scripts || {};
  const found = preferred.find((name) => scripts[name]);
  if (!found) return undefined;
  if (found === "start" || found === "test") return `npm ${found}`;
  return `npm run ${found}`;
}

function buildHowToUse(opts: {
  owner: string;
  repo: string;
  stack: TechStackItem[];
  paths: string[];
  pkgJson?: any;
  hasReadme: boolean;
  hasTests: boolean;
  isDemo?: boolean;
}): HowToUseStep[] {
  const slug = `${opts.owner}/${opts.repo}`;
  const hasPath = (re: RegExp) => opts.paths.some((p) => re.test(p));
  const tech = (name: string) => opts.stack.some((s) => s.name === name);
  const confidence: HowToUseStep["confidence"] = opts.isDemo ? "sample" : "verified";
  const inferred: HowToUseStep["confidence"] = opts.isDemo ? "sample" : "inferred";
  const packageManager =
    hasPath(/^pnpm-lock\.yaml$/) ? "pnpm" :
    hasPath(/^yarn\.lock$/) ? "yarn" :
    hasPath(/^bun\.lockb?$/) ? "bun" :
    "npm";

  const installCommand =
    opts.pkgJson ? `${packageManager} install` :
    hasPath(/^requirements\.txt$/) ? "python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" :
    hasPath(/^pyproject\.toml$/) ? "python -m venv .venv && source .venv/bin/activate && pip install -e ." :
    hasPath(/^Cargo\.toml$/) ? "cargo build" :
    hasPath(/^go\.mod$/) ? "go mod download" :
    undefined;

  const runCommand =
    opts.pkgJson ? (scriptCommand(opts.pkgJson, ["dev", "start", "serve", "preview"]) || `${packageManager} run dev`) :
    hasPath(/^Cargo\.toml$/) ? "cargo run" :
    hasPath(/^go\.mod$/) ? "go run ." :
    tech("FastAPI") ? "uvicorn main:app --reload" :
    tech("Django") ? "python manage.py runserver" :
    tech("Flask") ? "flask run" :
    undefined;

  const testCommand =
    opts.pkgJson ? (scriptCommand(opts.pkgJson, ["test", "test:unit", "check", "lint"]) || `${packageManager} test`) :
    hasPath(/^Cargo\.toml$/) ? "cargo test" :
    hasPath(/^go\.mod$/) ? "go test ./..." :
    (hasPath(/^requirements\.txt$/) || hasPath(/^pyproject\.toml$/)) ? "pytest" :
    undefined;

  const primaryModule =
    ["src/", "app/", "pages/", "client/", "server/", "packages/"].find((dir) =>
      hasPath(new RegExp(`^${dir.replace("/", "\\/")}`))
    ) ||
    opts.paths.find((p) => /^(src|app|server|client|packages)\b/i.test(p)) ||
    "README.md";

  const steps: HowToUseStep[] = [
    {
      title: "Start with the README",
      action: opts.hasReadme
        ? "Read the README first to understand the project promise, setup assumptions, and intended usage path."
        : "README coverage looks thin, so start with the repository tree and manifest files instead.",
      evidence: opts.hasReadme ? "README.md detected" : "README not detected or too thin",
      confidence,
    },
    {
      title: "Clone the repo",
      action: "Pull the source locally before making changes, then inspect the default branch and top-level folders.",
      command: `git clone https://github.com/${slug}.git && cd ${opts.repo}`,
      evidence: `GitHub repository ${slug}`,
      confidence,
    },
  ];

  if (installCommand) {
    steps.push({
      title: "Install dependencies",
      action: "Install the detected runtime dependencies before running or editing the project.",
      command: installCommand,
      evidence: opts.pkgJson ? "package.json detected" : "language manifest detected",
      confidence,
    });
  }

  if (runCommand) {
    steps.push({
      title: "Run it locally",
      action: "Start the development/runtime process, then open the local URL or terminal output shown by the framework.",
      command: runCommand,
      evidence: opts.pkgJson?.scripts ? "package.json scripts detected" : "runtime inferred from stack",
      confidence: opts.pkgJson?.scripts ? confidence : inferred,
    });
  }

  steps.push({
    title: "Find the main working area",
    action: `Use ${primaryModule} as your first map of the codebase. Trace from entry points into services, components, or modules before editing.`,
    evidence: `Primary module hint: ${primaryModule}`,
    confidence: primaryModule === "README.md" ? inferred : confidence,
  });

  if (testCommand) {
    steps.push({
      title: opts.hasTests ? "Run the tests" : "Check the quality baseline",
      action: opts.hasTests
        ? "Run the test command before changing code, then rerun it after your first edit."
        : "A clear test suite was not detected. Run the closest available check, then add a small smoke test before larger changes.",
      command: testCommand,
      evidence: opts.hasTests ? "test paths or test scripts detected" : "test command inferred from stack",
      confidence: opts.hasTests ? confidence : inferred,
    });
  }

  steps.push({
    title: "Use the prompt board",
    action: "Copy the onboarding, refactor, or test prompt below into your LLM with the repo open to turn this scan into an implementation plan.",
    evidence: "Generated from detected stack, modules, risks, and opportunities",
    confidence: inferred,
  });

  return steps.slice(0, 7);
}

function clampScore(score: number): number {
  return Math.max(1, Math.min(10, Math.round(score)));
}

function buildDecisionLayer(opts: {
  source: "github" | "demo";
  stars: number;
  forks: number;
  openIssues: number;
  daysSincePush: number;
  hasReadme: boolean;
  hasTests: boolean;
  hasCI: boolean;
  hasLicense: boolean;
  stackCount: number;
  risks: RiskItem[];
  opportunities: OpportunityItem[];
}): { verdict: RepoVerdict; scorecard: ScorecardItem[] } {
  const confidence: ScorecardItem["confidence"] = opts.source === "demo" ? "sample" : "verified";
  const inferred: ScorecardItem["confidence"] = opts.source === "demo" ? "sample" : "inferred";
  const adoption = clampScore(
    opts.stars >= 10_000 ? 10 :
    opts.stars >= 1_000 ? 8 :
    opts.stars >= 100 ? 6 :
    opts.stars >= 25 ? 4 :
    2
  );
  const maintenance = clampScore(
    opts.daysSincePush <= 14 ? 9 :
    opts.daysSincePush <= 60 ? 7 :
    opts.daysSincePush <= 180 ? 5 :
    3
  );
  const documentation = clampScore((opts.hasReadme ? 7 : 3) + (opts.hasLicense ? 1 : 0));
  const setupClarity = clampScore((opts.hasReadme ? 4 : 1) + (opts.stackCount >= 3 ? 2 : 1) + (opts.hasCI ? 1 : 0) + (opts.hasLicense ? 1 : 0));
  const testConfidence = clampScore((opts.hasTests ? 7 : 3) + (opts.hasCI ? 2 : 0));
  const issuePenalty = opts.openIssues > 500 ? 1 : opts.openIssues > 100 ? 0.5 : 0;

  const scorecard: ScorecardItem[] = [
    {
      label: "Maintenance",
      score: clampScore(maintenance - issuePenalty),
      reason: opts.daysSincePush <= 14 ? "Recent push activity suggests active maintenance." : `Last push was ${opts.daysSincePush} days ago, so maintenance should be checked before relying on it.`,
      confidence,
    },
    {
      label: "Documentation",
      score: documentation,
      reason: opts.hasReadme ? "README detected and used for the repo briefing." : "README looks missing or too thin for confident onboarding.",
      confidence,
    },
    {
      label: "Setup clarity",
      score: setupClarity,
      reason: opts.stackCount > 0 ? `${opts.stackCount} technologies were detected, giving setup clues.` : "Few setup signals were detected from manifests or framework files.",
      confidence: inferred,
    },
    {
      label: "Test confidence",
      score: testConfidence,
      reason: opts.hasTests ? "Test tooling or test folders were detected." : "No clear test suite was detected, so verify behavior before adopting.",
      confidence,
    },
    {
      label: "Adoption signal",
      score: adoption,
      reason: `${opts.stars.toLocaleString()} stars and ${opts.forks.toLocaleString()} forks indicate ${adoption >= 8 ? "strong" : adoption >= 5 ? "moderate" : "early"} public traction.`,
      confidence,
    },
  ];

  const average = scorecard.reduce((sum, item) => sum + item.score, 0) / scorecard.length;
  const topRisks = opts.risks.slice(0, 2).map((risk) => risk.title);
  const strongAdoption = adoption >= 8;
  const weakTests = testConfidence < 6;
  const weakDocs = documentation < 6;
  const stale = maintenance < 5;

  let recommendation: RepoVerdict["recommendation"] = "investigate";
  let label = "Investigate before committing";
  let rationale = "This repo has useful signals, but the setup, risk, and maintenance profile should be checked before using it as a dependency or foundation.";
  let bestFor = ["technical evaluation", "learning", "implementation research"];
  let nextAction = "Run the local setup and inspect the main module boundaries before building on top of it.";

  if (average >= 7.5 && strongAdoption && !weakTests && !stale) {
    recommendation = "adopt";
    label = "Adopt with normal due diligence";
    rationale = "The repo shows strong adoption, recent maintenance, and enough quality signals to justify deeper adoption work.";
    bestFor = ["production evaluation", "team adoption", "reference implementation"];
    nextAction = "Run the setup path, review open issues, and compare the architecture against your production constraints.";
  } else if (strongAdoption && (weakTests || weakDocs)) {
    recommendation = "study";
    label = "Study before adopting";
    rationale = "The repo has strong public traction, but the quality or onboarding signals need verification before you depend on it.";
    bestFor = ["learning", "architecture research", "implementation inspiration"];
    nextAction = "Use the repo as a reference first, then validate tests, license, and setup before using it in production.";
  } else if (average >= 6 && opts.opportunities.some((opp) => opp.area === "monetization" || opp.area === "ai")) {
    recommendation = "fork";
    label = "Promising fork or product wedge";
    rationale = "The repo has enough useful structure and opportunity signals to explore a focused fork, extension, or commercial wrapper.";
    bestFor = ["forking", "AI-assisted extension", "commercial exploration"];
    nextAction = "Pick one opportunity from the heatmap and test whether it can become a useful add-on within a week.";
  } else if (average < 4 || stale) {
    recommendation = "avoid";
    label = "Avoid for serious use until verified";
    rationale = "The repo currently lacks enough maintenance or quality confidence for serious adoption without manual review.";
    bestFor = ["light research", "code archaeology", "idea mining"];
    nextAction = "Check recent issues, forks, and alternatives before investing setup time.";
  }

  const verdict: RepoVerdict = {
    recommendation,
    label,
    confidence: opts.source === "demo" ? "low" : average >= 7 || average <= 4 ? "high" : "medium",
    bestFor,
    rationale,
    watchouts: topRisks.length ? topRisks : ["Validate setup locally", "Review open issues before committing"],
    nextAction,
  };

  return { verdict, scorecard };
}

async function tryRealAnalysis(owner: string, repo: string): Promise<RepoAnalysis | null> {
  const repoRes = await ghFetch(`/repos/${owner}/${repo}`);
  if (!repoRes.ok) return null;
  const meta = (await safeJson<GHRepo>(repoRes))!;
  if (!meta) return null;

  // README
  let readmeText = "";
  let hasReadme = false;
  try {
    const r = await ghFetch(`/repos/${owner}/${repo}/readme`, {
      headers: { Accept: "application/vnd.github.raw" },
    });
    if (r.ok) {
      readmeText = await r.text();
      hasReadme = readmeText.length > 50;
    }
  } catch {}

  // Tree (recursive)
  let tree: GHTreeItem[] = [];
  try {
    const t = await ghFetch(`/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`);
    if (t.ok) {
      const j = await safeJson<GHTree>(t);
      tree = j?.tree || [];
    }
  } catch {}

  const paths = tree.map((t) => t.path).filter(Boolean);

  // Detect manifests
  const pkgPath = tree.find((t) => t.path === "package.json");
  let pkgJson: any = null;
  if (pkgPath) {
    try {
      const p = await ghFetch(`/repos/${owner}/${repo}/contents/package.json?ref=${meta.default_branch}`, {
        headers: { Accept: "application/vnd.github.raw" },
      });
      if (p.ok) pkgJson = await p.json();
    } catch {}
  }

  const findContents = async (p: string) => {
    try {
      const r = await ghFetch(`/repos/${owner}/${repo}/contents/${p}?ref=${meta.default_branch}`, {
        headers: { Accept: "application/vnd.github.raw" },
      });
      if (r.ok) return await r.text();
    } catch {}
    return undefined;
  };

  const hasPath = (re: RegExp) => paths.some((p) => re.test(p));
  const [pyProject, reqTxt, cargoToml, goMod, gemfile, composer] = await Promise.all([
    hasPath(/^pyproject\.toml$/) ? findContents("pyproject.toml") : Promise.resolve(undefined),
    hasPath(/^requirements\.txt$/) ? findContents("requirements.txt") : Promise.resolve(undefined),
    hasPath(/^Cargo\.toml$/) ? findContents("Cargo.toml") : Promise.resolve(undefined),
    hasPath(/^go\.mod$/) ? findContents("go.mod") : Promise.resolve(undefined),
    hasPath(/^Gemfile$/) ? findContents("Gemfile") : Promise.resolve(undefined),
    hasPath(/^composer\.json$/) ? findContents("composer.json") : Promise.resolve(undefined),
  ]);
  let composerJson: any = undefined;
  try { if (composer) composerJson = JSON.parse(composer); } catch {}

  const { stack, runtimeDeps, devDeps } = detectFromManifests({
    pkgJson,
    pyProject,
    reqTxt,
    cargoToml,
    goMod,
    gemfile,
    composer: composerJson,
    hasDockerfile: hasPath(/^Dockerfile$/i),
    hasGitHubActions: hasPath(/^\.github\/workflows\//),
    hasVercel: hasPath(/^vercel\.json$/),
    paths,
  });
  if (meta.language && !stack.find((s) => s.name === meta.language)) {
    stack.unshift({ name: meta.language, category: "language", confidence: 1, evidence: "GitHub primary language" });
  }

  const complexity = inferModules(paths);
  const architecture = buildArchitecture(stack, paths, owner, repo);

  // Summary
  const cleanedReadme = (readmeText || "")
    // strip HTML blocks/tags
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    // strip code fences
    .replace(/```[\s\S]*?```/g, "")
    // strip images and links to their text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // strip badges urls leftover
    .replace(/https?:\/\/\S+/g, "")
    // strip heading markers and emphasis
    .replace(/^[ \t]*#{1,6}[ \t]+.*$/gm, "")
    .replace(/[*_`]/g, "")
    // collapse whitespace
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  const readmeFirstPara =
    cleanedReadme
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p.length > 60 && !/^[\s\W]*$/.test(p))
      ?.slice(0, 420) || meta.description || "";

  const summary = {
    headline: meta.description || `${repo} — by ${owner}`,
    purpose:
      readmeFirstPara ||
      `${repo} is a ${stack.find((s) => s.category === "framework")?.name || meta.language || "software"} project maintained by ${owner}.`,
    audience:
      stack.some((s) => s.category === "ai")
        ? "AI builders and developers integrating LLMs"
        : stack.some((s) => s.name === "Next.js" || s.name === "React")
        ? "Web developers building modern frontends"
        : stack.some((s) => s.category === "infra")
        ? "Platform and infrastructure engineers"
        : "Developers and contributors in the ecosystem",
    pitch: `${meta.stargazers_count.toLocaleString()} stars · ${meta.forks_count.toLocaleString()} forks · ${stack.length} detected technologies. ${meta.topics?.length ? "Topics: " + meta.topics.slice(0, 4).join(", ") + "." : ""}`,
  };

  const hasTests =
    hasPath(/^(tests?|__tests__)\//) ||
    runtimeDeps.concat(devDeps).some((d) => /^(jest|vitest|mocha|playwright|cypress|pytest|rspec)$/.test(d.name));
  const hasCI = hasPath(/^\.github\/workflows\//) || hasPath(/^\.circleci\//) || hasPath(/^\.travis/);
  const hasLicense = !!meta.license || hasPath(/^LICENSE/i);

  const pushedAt = meta.pushed_at ? new Date(meta.pushed_at).getTime() : Date.now();
  const daysSincePush = Math.floor((Date.now() - pushedAt) / 86400_000);
  const howToUse = buildHowToUse({ owner, repo, stack, paths, pkgJson, hasReadme, hasTests });
  const { risks, opportunities } = buildRisksAndOpps({
    pkgJson, hasReadme, hasTests, hasCI, hasLicense, stars: meta.stargazers_count, daysSincePush, isDemo: false,
  });
  const { verdict, scorecard } = buildDecisionLayer({
    source: "github",
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    openIssues: meta.open_issues_count,
    daysSincePush,
    hasReadme,
    hasTests,
    hasCI,
    hasLicense,
    stackCount: stack.length,
    risks,
    opportunities,
  });

  // Dependency edges: top runtime deps, link to api/core
  const depEdges: DependencyEdge[] = runtimeDeps.slice(0, 8).map((d) => ({
    from: "core",
    to: d.name,
    weight: 1,
  }));

  // Evidence (real, links to files)
  const evidence: EvidenceItem[] = [];
  if (hasReadme) evidence.push({ label: "README.md", path: `${owner}/${repo}/README.md`, note: "First paragraph used for purpose summary.", isReal: true });
  if (pkgPath) evidence.push({ label: "package.json", path: `${owner}/${repo}/package.json`, note: `Detected ${runtimeDeps.length} runtime + ${devDeps.length} dev dependencies.`, isReal: true });
  if (hasCI) evidence.push({ label: ".github/workflows/", path: `${owner}/${repo}/.github/workflows`, note: "CI pipelines present.", isReal: true });
  if (hasLicense) evidence.push({ label: "LICENSE", path: `${owner}/${repo}/LICENSE`, note: `License: ${meta.license?.spdx_id || "detected"}.`, isReal: true });
  for (const m of complexity.slice(0, 6)) {
    evidence.push({ label: `${m.name}/`, path: `${owner}/${repo}/${m.name}`, note: `${m.size} files; complexity ${m.complexity}.`, isReal: true });
  }

  return {
    source: "github",
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    fetchedAt: new Date().toISOString(),
    repoMeta: {
      description: meta.description,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      watchers: meta.watchers_count,
      openIssues: meta.open_issues_count,
      license: meta.license?.spdx_id || meta.license?.name || null,
      primaryLanguage: meta.language,
      defaultBranch: meta.default_branch,
      createdAt: meta.created_at,
      updatedAt: meta.updated_at,
      pushedAt: meta.pushed_at,
      topics: meta.topics || [],
      sizeKB: meta.size,
      homepage: meta.homepage,
    },
    summary,
    techStack: stack,
    architecture,
    complexity,
    dependencies: { runtime: runtimeDeps.slice(0, 30), dev: devDeps.slice(0, 30), edges: depEdges },
    risks,
    opportunities,
    verdict,
    scorecard,
    howToUse,
    prompts: buildPrompts(owner, repo, meta.language),
    evidence,
    notes: [],
  };
}

function buildDemoAnalysis(owner: string, repo: string, reason: string): RepoAnalysis {
  // Deterministic-ish demo based on owner/repo string hash
  const seed = (owner + "/" + repo).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (n: number) => ((seed * 9301 + 49297) % 233280) / 233280 * n;

  const stack: TechStackItem[] = [
    { name: "TypeScript", category: "language", confidence: 0.9, evidence: "demo: inferred from common GitHub repos" },
    { name: "React", category: "framework", confidence: 0.85, evidence: "demo" },
    { name: "Node.js", category: "runtime", confidence: 0.85, evidence: "demo" },
    { name: "Vite", category: "tooling", confidence: 0.7, evidence: "demo" },
    { name: "Tailwind CSS", category: "framework", confidence: 0.7, evidence: "demo" },
    { name: "PostgreSQL", category: "data", confidence: 0.6, evidence: "demo" },
    { name: "GitHub Actions", category: "infra", confidence: 0.7, evidence: "demo" },
  ];
  const complexity: ComplexityModule[] = [
    { name: "src", path: "src/", size: Math.floor(60 + rng(40)), complexity: "high", reason: "core application code" },
    { name: "server", path: "server/", size: Math.floor(30 + rng(20)), complexity: "medium", reason: "API and routing" },
    { name: "client", path: "client/", size: Math.floor(40 + rng(20)), complexity: "medium", reason: "UI components" },
    { name: "shared", path: "shared/", size: Math.floor(10 + rng(8)), complexity: "low", reason: "shared types" },
    { name: "scripts", path: "scripts/", size: 6, complexity: "low", reason: "build & ops" },
    { name: "tests", path: "tests/", size: Math.floor(15 + rng(10)), complexity: "medium" },
    { name: "docs", path: "docs/", size: 4, complexity: "low" },
  ];
  const architecture = {
    nodes: [
      { id: "user", label: "User / Client", kind: "external" as const },
      { id: "ui", label: "UI Layer", kind: "ui" as const, description: "React + Tailwind" },
      { id: "api", label: "API / Server", kind: "service" as const, description: "Node/Express" },
      { id: "db", label: "PostgreSQL", kind: "data" as const },
      { id: "ci", label: "GitHub Actions", kind: "module" as const },
    ],
    edges: [
      { from: "user", to: "ui", kind: "control" as const, label: "interacts" },
      { from: "ui", to: "api", kind: "data" as const, label: "fetch" },
      { from: "api", to: "db", kind: "data" as const, label: "reads/writes" },
      { from: "ci", to: "api", kind: "depends" as const, label: "ships" },
    ],
  };
  const runtimeDeps = [
    { name: "react", version: "18.x" }, { name: "react-dom", version: "18.x" },
    { name: "express", version: "4.x" }, { name: "drizzle-orm", version: "0.30.x" },
    { name: "zod", version: "3.x" }, { name: "wouter", version: "3.x" },
    { name: "@tanstack/react-query", version: "5.x" }, { name: "lucide-react", version: "0.x" },
  ];
  const { risks, opportunities } = buildRisksAndOpps({
    pkgJson: true, hasReadme: true, hasTests: false, hasCI: true, hasLicense: false, stars: 1200, daysSincePush: 22, isDemo: true,
  });
  const { verdict, scorecard } = buildDecisionLayer({
    source: "demo",
    stars: 1200,
    forks: 87,
    openIssues: 14,
    daysSincePush: 22,
    hasReadme: true,
    hasTests: false,
    hasCI: true,
    hasLicense: false,
    stackCount: stack.length,
    risks,
    opportunities,
  });
  const demoPkg = {
    scripts: { dev: "vite --host 0.0.0.0", test: "vitest run" },
    dependencies: { react: "18.x", express: "4.x" },
  };
  const howToUse = buildHowToUse({
    owner,
    repo,
    stack,
    paths: ["README.md", "package.json", "src/App.tsx", "server/index.ts", "tests/smoke.test.ts", ".github/workflows/ci.yml"],
    pkgJson: demoPkg,
    hasReadme: true,
    hasTests: false,
    isDemo: true,
  });

  return {
    source: "demo",
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    fetchedAt: new Date().toISOString(),
    repoMeta: {
      description: `(Demo data) ${repo} — a sample project shown when the live GitHub API was unavailable.`,
      stars: 1234, forks: 87, watchers: 56, openIssues: 14,
      license: null, primaryLanguage: "TypeScript", defaultBranch: "main",
      createdAt: null, updatedAt: null, pushedAt: null,
      topics: ["sample", "demo", "sourcebrief"], sizeKB: 4321, homepage: null,
    },
    summary: {
      headline: `${repo} — illustrative repo for ${owner}`,
      purpose: `This is a simulated analysis of ${owner}/${repo} shown because the live GitHub API call failed (${reason}). The numbers and modules below are representative, not measured.`,
      audience: "Developers exploring the repo intelligence concept",
      pitch: "Demo / fallback data — connect a public repo URL to see real analysis.",
    },
    techStack: stack,
    architecture,
    complexity,
    dependencies: { runtime: runtimeDeps, dev: [], edges: runtimeDeps.slice(0, 6).map((d) => ({ from: "core", to: d.name, weight: 1 })) },
    risks,
    opportunities,
    verdict,
    scorecard,
    howToUse,
    prompts: buildPrompts(owner, repo, "TypeScript"),
    evidence: [
      { label: "README.md (sample)", path: `${owner}/${repo}/README.md`, note: "Demo evidence — not a live file read.", isReal: false },
      { label: "package.json (sample)", path: `${owner}/${repo}/package.json`, note: "Demo evidence — not a live file read.", isReal: false },
      { label: "src/ (sample)", path: `${owner}/${repo}/src`, note: "Demo evidence — not a live file read.", isReal: false },
      { label: ".github/workflows/ (sample)", path: `${owner}/${repo}/.github/workflows`, note: "Demo evidence — not a live file read.", isReal: false },
    ],
    notes: [
      "Fallback / simulated analysis. Try a different public repo URL or try again later for live data.",
    ],
  };
}

export async function analyzeRepo(input: string): Promise<{ ok: true; data: RepoAnalysis } | { ok: false; error: string }> {
  const parsed = parseRepoUrl(input);
  if (!parsed) return { ok: false, error: "Couldn't parse a GitHub repo from that input. Try https://github.com/owner/repo or owner/repo." };
  const { owner, repo } = parsed;
  try {
    const real = await tryRealAnalysis(owner, repo);
    if (real) return { ok: true, data: real };
    return { ok: true, data: buildDemoAnalysis(owner, repo, "repo not found or rate-limited") };
  } catch (e: any) {
    return { ok: true, data: buildDemoAnalysis(owner, repo, e?.message || "network error") };
  }
}
