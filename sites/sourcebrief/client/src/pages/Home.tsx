import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { RepoAnalysis } from "@shared/schema";

import { Logo } from "@/components/Logo";
import { RepoInput } from "@/components/RepoInput";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { Dashboard } from "@/components/Dashboard";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Sparkles, Github, Zap, Map, ShieldAlert, Lightbulb, Bookmark, SearchCheck } from "lucide-react";

export default function Home() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const { theme, toggle } = useTheme();

  const mutation = useMutation<RepoAnalysis, Error, string>({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/analyze", { url });
      return (await res.json()) as RepoAnalysis;
    },
  });

  const onAnalyze = (url: string) => {
    setSubmitted(url);
    mutation.reset();
    mutation.mutate(url);
  };

  const onBack = () => {
    setSubmitted(null);
    mutation.reset();
  };

  const showDashboard = !!mutation.data && submitted;
  const showProgress = mutation.isPending && submitted;

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Top nav */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/70">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="hover-elevate rounded-md px-1.5 py-1 -ml-1.5"
            aria-label="Go to home"
            data-testid="button-home"
          >
            <Logo />
          </button>
          <nav className="flex items-center gap-1">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground" data-testid="label-free-utility">
              <SearchCheck className="h-3.5 w-3.5 text-primary" /> Free utility
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 hover-elevate"
              data-testid="link-github"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              data-testid="button-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8 py-10 md:py-14">
        {/* HERO / LANDING */}
        {!submitted && (
          <Landing onAnalyze={onAnalyze} error={mutation.error?.message ?? null} />
        )}

        {/* PROGRESS */}
        {showProgress && (
          <div className="py-8">
            <AnalysisProgress repoLabel={submitted!} />
          </div>
        )}

        {/* ERROR */}
        {!showDashboard && !mutation.isPending && submitted && mutation.error && (
          <div className="py-8 mx-auto max-w-2xl">
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-sm" data-testid="text-error-banner">
              <div className="font-medium text-destructive mb-1">We couldn't analyze that repo.</div>
              <div className="text-muted-foreground">{mutation.error.message}</div>
              <Button variant="outline" className="mt-3" onClick={onBack} data-testid="button-error-back">
                Try another repo
              </Button>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {showDashboard && <Dashboard data={mutation.data!} onBack={onBack} />}
      </main>

      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo withWordmark={false} />
            <span>© {new Date().getFullYear()} SourceBrief</span>
          </div>
          <div className="flex items-center gap-4">
            <span data-testid="text-footer-free">Free GitHub repo briefing utility</span>
            <a href="https://docs.github.com/en/rest" target="_blank" rel="noreferrer noopener" className="hover:text-foreground">Powered by GitHub Public API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Landing({ onAnalyze, error }: { onAnalyze: (u: string) => void; error: string | null }) {
  return (
    <div className="space-y-20 md:space-y-28">
      {/* Hero */}
      <section className="relative pt-8 md:pt-14">
        <div className="absolute inset-0 -z-10 bg-grid bg-grid-fade opacity-25" aria-hidden />
        <div className="absolute left-1/2 -translate-x-1/2 top-8 h-60 w-[34rem] -z-10 bg-primary/[0.07] blur-3xl rounded-full pointer-events-none" aria-hidden />

        <div className="text-center max-w-3xl mx-auto space-y-5">
          <Badge variant="outline" className="bg-card/70 px-3 py-1 text-[11px] backdrop-blur" data-testid="badge-hero">
            <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
            Instant repo briefing
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[0.98]" data-testid="text-hero-title">
            Turn any GitHub repo into a visual briefing.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-7" data-testid="text-hero-subtitle">
            See the stack, architecture, risks, opportunities, and best next prompts before you read the code.
          </p>

          <div className="pt-3 max-w-2xl mx-auto">
            <RepoInput onAnalyze={onAnalyze} error={error} />
          </div>

          <div className="flex items-center justify-center gap-3 pt-0 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Public repos work instantly
            </span>
            <span>·</span>
            <span>No login required</span>
          </div>

          <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-border/70 bg-card/50 p-3 shadow-sm backdrop-blur" data-testid="hero-preview">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 text-left">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Preview output</div>
                  <div className="font-display text-sm font-semibold">Architecture map · Risk heatmap · Prompt board</div>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/20">Visual brief</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <div className="relative min-h-40 rounded-xl border border-border/70 bg-card p-4 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,hsl(var(--primary)/0.12),transparent_32%),radial-gradient(circle_at_80%_70%,hsl(var(--accent)/0.10),transparent_30%)]" />
                  <div className="relative grid grid-cols-3 gap-3 text-[11px]">
                    {["UI", "API", "Data", "Auth", "Tests", "Deploy"].map((node, index) => (
                      <div key={node} className={`rounded-lg border border-border bg-background/80 px-3 py-2 text-center shadow-sm ${index === 1 ? "text-primary border-primary/40" : ""}`}>
                        {node}
                      </div>
                    ))}
                  </div>
                  <div className="relative mt-5 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-primary/70" />
                  </div>
                  <div className="relative mt-3 grid grid-cols-3 gap-2">
                    <div className="h-8 rounded-lg bg-primary/15" />
                    <div className="h-8 rounded-lg bg-amber-500/20" />
                    <div className="h-8 rounded-lg bg-accent/15" />
                  </div>
                </div>
                <div className="grid gap-3 text-left">
                  {["Stack detected", "Risks ranked", "Prompts generated"].map((label, index) => (
                    <div key={label} className="rounded-xl border border-border/70 bg-card px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">0{index + 1}</div>
                      <div className="text-sm font-medium">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-5 hover-elevate transition" data-testid={`feature-${f.id}`}>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3">
              <f.icon className="h-5 w-5" />
            </div>
            <div className="font-display text-base font-semibold mb-1">{f.title}</div>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge variant="outline" className="mb-3">How it works</Badge>
          <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight" data-testid="text-how-title">
            Five stages, sixty seconds, one demoable artifact.
          </h2>
        </div>
        <ol className="grid md:grid-cols-5 gap-3" data-testid="list-stages">
          {STAGES.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-border bg-card p-4">
              <div className="font-mono text-[11px] text-muted-foreground">0{i + 1}</div>
              <div className="font-medium mt-1 text-sm">{s.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.body}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* Free utility positioning */}
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/[0.06] via-background to-accent/[0.06] p-8 md:p-12 text-center relative overflow-hidden" data-testid="section-free-utility">
        <div className="absolute inset-0 -z-10 bg-grid opacity-30" />
        <Badge variant="outline" className="mb-3 bg-primary/10 border-primary/30 text-primary">
          <Bookmark className="h-3 w-3 mr-1.5" /> Free public repo utility
        </Badge>
        <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight max-w-xl mx-auto" data-testid="text-free-utility-title">
          Built to help you understand open-source repos faster.
        </h2>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
          SourceBrief is moving toward a free, searchable library of visual GitHub repo briefings. No plans, no paywall, no account required for public repos.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1">Public repos</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">Visual verdicts</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">Setup guidance</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">Shareable pages next</span>
        </div>
      </section>
    </div>
  );
}

const FEATURES = [
  { id: "zap", title: "60-second briefings", body: "Drop a URL, get a one-page dashboard. No clone, no setup.", icon: Zap },
  { id: "map", title: "Visual architecture", body: "See entry points, services, data layers, and external calls at a glance.", icon: Map },
  { id: "risk", title: "Risks & opportunities", body: "Tests, CI, licensing, hotspots, and monetization angles ranked on a heatmap.", icon: ShieldAlert },
  { id: "prompts", title: "AI prompt board", body: "Eight ready-to-paste prompts to understand, extend, refactor, and ship.", icon: Lightbulb },
];

const STAGES = [
  { title: "Read repo", body: "Metadata, tree, README via GitHub's public API." },
  { title: "Detect stack", body: "Manifests, frameworks, infra, AI providers." },
  { title: "Map architecture", body: "Infer UI · API · data · external services." },
  { title: "Score risks", body: "Tests, CI, license, freshness, hotspots." },
  { title: "Visualize", body: "Treemap, graph, heatmap, prompt board, evidence." },
];
