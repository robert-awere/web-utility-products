import type { RepoAnalysis } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Star, GitFork, Eye, AlertCircle, Scale, Calendar, ExternalLink, ArrowLeft,
  Cpu, Layers, GitBranch, ShieldAlert, Sparkles, FileText, Lightbulb, Wand2,
  TestTube2, BookOpen, Megaphone, DollarSign, Hammer, Database, Server, Globe, Cloud, Brain, Boxes,
  Terminal, ClipboardList, CheckCircle2, Compass, Target, AlertTriangle,
} from "lucide-react";
import { ArchitectureMap } from "./viz/ArchitectureMap";
import { ComplexityTreemap } from "./viz/ComplexityTreemap";
import { DependencyFlow } from "./viz/DependencyFlow";
import { RiskHeatmap } from "./viz/RiskHeatmap";

const CATEGORY_ICON: Record<string, any> = {
  language: Cpu,
  framework: Layers,
  runtime: Server,
  tooling: Hammer,
  infra: Cloud,
  data: Database,
  ai: Brain,
};

const PROMPT_ICON: Record<string, any> = {
  understand: BookOpen,
  extend: Wand2,
  refactor: Hammer,
  test: TestTube2,
  document: FileText,
  market: Megaphone,
  monetize: DollarSign,
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400_000);
  if (d < 1) return "today";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function num(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

export function Dashboard({ data, onBack }: { data: RepoAnalysis; onBack: () => void }) {
  return (
    <div className="space-y-8" data-testid="region-dashboard">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground rounded-md px-2 py-1 -ml-2 hover-elevate"
              data-testid="button-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> New scan
            </button>
            {data.source === "demo" ? (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" data-testid="badge-demo">
                Demo data
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" data-testid="badge-live">
                Live GitHub data
              </Badge>
            )}
          </div>
          <h1 className="font-display text-xl md:text-2xl font-semibold tracking-tight" data-testid="text-repo-title">
            <span className="text-muted-foreground">{data.owner}</span>
            <span className="text-muted-foreground">/</span>
            <span>{data.repo}</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl" data-testid="text-headline">
            {data.summary.headline}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs font-mono rounded-md border border-border bg-card px-2.5 py-1.5 hover-elevate"
            data-testid="link-repo"
          >
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="region-stats">
        <StatPill icon={Star} label="Stars" value={num(data.repoMeta.stars)} testid="stat-stars" />
        <StatPill icon={GitFork} label="Forks" value={num(data.repoMeta.forks)} testid="stat-forks" />
        <StatPill icon={Eye} label="Watchers" value={num(data.repoMeta.watchers)} testid="stat-watchers" />
        <StatPill icon={AlertCircle} label="Open issues" value={num(data.repoMeta.openIssues)} testid="stat-issues" />
        <StatPill icon={Calendar} label="Last push" value={timeAgo(data.repoMeta.pushedAt)} testid="stat-push" />
      </div>

      {/* Executive summary */}
      <Card className="p-6 md:p-8 relative overflow-hidden" data-testid="card-summary">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative space-y-4">
          <SectionTitle icon={Sparkles} kicker="Executive summary" title="What this repo is" />
          <p className="text-base leading-relaxed text-foreground/90" data-testid="text-purpose">
            {data.summary.purpose}
          </p>
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <MetaBlock label="Audience" value={data.summary.audience} testid="text-audience" />
            <MetaBlock label="Pitch" value={data.summary.pitch} testid="text-pitch" />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {(data.repoMeta.topics || []).slice(0, 8).map((t) => (
              <Badge key={t} variant="secondary" className="font-mono text-[10px]" data-testid={`badge-topic-${t}`}>#{t}</Badge>
            ))}
            {data.repoMeta.license && (
              <Badge variant="outline" className="font-mono text-[10px]" data-testid="badge-license">
                <Scale className="h-3 w-3 mr-1" />
                {data.repoMeta.license}
              </Badge>
            )}
            {data.repoMeta.primaryLanguage && (
              <Badge variant="outline" className="font-mono text-[10px]" data-testid="badge-language">
                {data.repoMeta.primaryLanguage}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Repo verdict */}
      <section data-testid="region-verdict">
        <SectionTitle icon={Compass} kicker="Repo verdict" title="Should you use this repo?" />
        <div className="mt-4 grid lg:grid-cols-[0.95fr_1.05fr] gap-4">
          <Card className="p-5 md:p-6 relative overflow-hidden" data-testid="card-verdict">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary uppercase tracking-wider text-[10px]">
                  {data.verdict.recommendation}
                </Badge>
                <Badge variant="outline" className="uppercase tracking-wider text-[10px]">
                  {data.verdict.confidence} confidence
                </Badge>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight" data-testid="text-verdict-label">
                  {data.verdict.label}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground" data-testid="text-verdict-rationale">
                  {data.verdict.rationale}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Target className="h-3 w-3 text-primary" /> Best for
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.verdict.bestFor.map((item) => (
                      <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-amber-500" /> Watchouts
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {data.verdict.watchouts.map((item) => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-[10px] uppercase tracking-wider text-primary">Best next action</div>
                <p className="mt-1 text-sm leading-6" data-testid="text-verdict-next-action">{data.verdict.nextAction}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 md:p-6" data-testid="card-scorecard">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Scorecard</div>
                <div className="font-display text-base font-semibold">Decision signals</div>
              </div>
              <Badge variant="outline" className="text-[10px]">out of 10</Badge>
            </div>
            <div className="space-y-4">
              {data.scorecard.map((item) => (
                <div key={item.label} data-testid={`row-scorecard-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <ConfidenceBadge confidence={item.confidence} />
                    </div>
                    <span className="font-mono text-sm">{item.score}/10</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${item.score * 10}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.reason}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* How to use */}
      <section data-testid="region-how-to-use">
        <SectionTitle icon={ClipboardList} kicker="Action plan" title="How to use this repo" />
        <div className="mt-4 grid lg:grid-cols-[0.9fr_1.1fr] gap-4">
          <Card className="p-5 md:p-6 relative overflow-hidden">
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight">From scan to first run</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  A practical path for opening the repo, finding the right files, running it locally, and using the prompts below without getting lost in the tree.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tip:</span> Treat verified steps as repo-backed. Treat inferred steps as a starting hypothesis to confirm in the README or manifest files.
              </div>
            </div>
          </Card>

          <Card className="divide-y divide-border/80" data-testid="card-how-to-use-steps">
            {data.howToUse.map((step, i) => (
              <div key={`${step.title}-${i}`} className="p-4 md:p-5" data-testid={`row-how-to-use-${i}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-mono text-primary">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <ConfidenceBadge confidence={step.confidence} />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{step.action}</p>
                    {step.command && (
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <pre className="overflow-x-auto text-xs font-mono leading-relaxed text-foreground/90">{step.command}</pre>
                        <div className="mt-2">
                          <CopyButton text={step.command} testid={`button-copy-how-to-use-${i}`} label="Copy command" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {step.evidence}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </section>

      {/* Tech stack */}
      <section data-testid="region-stack">
        <SectionTitle icon={Layers} kicker="Detected" title="Tech stack" />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.techStack.map((t) => {
            const Icon = CATEGORY_ICON[t.category] || Boxes;
            return (
              <Card key={t.name} className="p-4 hover-elevate transition" data-testid={`card-stack-${t.name}`}>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{t.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.category}</div>
                    <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary/80 rounded-full" style={{ width: `${Math.round(t.confidence * 100)}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">{t.evidence}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Architecture */}
      <section data-testid="region-architecture">
        <SectionTitle icon={GitBranch} kicker="Architecture" title="How the pieces fit" />
        <Card className="mt-4 p-4 md:p-6">
          <ArchitectureMap nodes={data.architecture.nodes} edges={data.architecture.edges} />
        </Card>
      </section>

      {/* Complexity treemap + Dependencies side by side on desktop */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section data-testid="region-complexity">
          <SectionTitle icon={Boxes} kicker="Complexity" title="Module map" />
          <Card className="mt-4 p-4 md:p-6">
            <ComplexityTreemap modules={data.complexity} />
          </Card>
        </section>

        <section data-testid="region-dependencies">
          <SectionTitle icon={GitBranch} kicker="Dependencies" title="Top runtime deps" />
          <Card className="mt-4 p-4 md:p-6">
            <DependencyFlow deps={data.dependencies} />
          </Card>
        </section>
      </div>

      {/* Risk heatmap */}
      <section data-testid="region-risks">
        <SectionTitle icon={ShieldAlert} kicker="Risks & opportunities" title="Heatmap" />
        <Card className="mt-4 p-4 md:p-6">
          <RiskHeatmap risks={data.risks} opportunities={data.opportunities} />
        </Card>
      </section>

      {/* Prompt board */}
      <section data-testid="region-prompts">
        <SectionTitle icon={Lightbulb} kicker="AI prompt board" title="Use this repo with your LLM" />
        <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.prompts.map((p, i) => {
            const Icon = PROMPT_ICON[p.category] || Lightbulb;
            return (
              <Card key={i} className="p-4 flex flex-col gap-3" data-testid={`card-prompt-${p.category}-${i}`}>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-accent/15 text-accent grid place-items-center">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.category}</div>
                </div>
                <div className="font-medium text-sm">{p.title}</div>
                <pre className="text-xs font-mono leading-relaxed bg-muted/40 rounded-md p-3 whitespace-pre-wrap text-foreground/80 max-h-44 overflow-auto">
{p.prompt}
                </pre>
                <CopyButton text={p.prompt} testid={`button-copy-${p.category}-${i}`} />
              </Card>
            );
          })}
        </div>
      </section>

      {/* Evidence */}
      <section data-testid="region-evidence">
        <SectionTitle icon={FileText} kicker="Evidence" title="What we looked at" />
        <Card className="mt-4 divide-y divide-border">
          {data.evidence.map((e, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3" data-testid={`row-evidence-${i}`}>
              <div className={`h-2 w-2 rounded-full mt-2 ${e.isReal ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm truncate">{e.path}</span>
                  {!e.isReal && <Badge variant="outline" className="text-[9px]">sample</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{e.note}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {data.notes.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5" data-testid="card-notes">
          <div className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Notes</div>
          <ul className="text-sm space-y-1">
            {data.notes.map((n, i) => <li key={i}>· {n}</li>)}
          </ul>
        </Card>
      )}

      <Separator />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-8">
        <div className="text-xs text-muted-foreground">
          Scanned {new Date(data.fetchedAt).toLocaleString()} · {data.source === "github" ? "live data from GitHub public API" : "demo / fallback data"}
        </div>
        <Button variant="outline" onClick={onBack} data-testid="button-scan-another">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Scan another repo
        </Button>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, testid }: any) {
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3 flex items-center gap-3" data-testid={testid}>
      <Icon className="h-4 w-4 text-primary" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, kicker, title }: any) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-md bg-primary/10 text-primary grid place-items-center">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{kicker}</div>
        <div className="font-display text-base font-semibold">{title}</div>
      </div>
    </div>
  );
}

function MetaBlock({ label, value, testid }: any) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "verified" | "inferred" | "sample" }) {
  const classes = {
    verified: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    inferred: "border-primary/40 bg-primary/10 text-primary",
    sample: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[confidence];
  return (
    <Badge variant="outline" className={`text-[9px] uppercase tracking-wider ${classes}`}>
      {confidence}
    </Badge>
  );
}

import { useState } from "react";
import { Copy, Check as CheckIcon } from "lucide-react";
function CopyButton({ text, testid, label = "Copy prompt" }: { text: string; testid: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="self-start inline-flex items-center gap-1.5 text-xs rounded-md border border-border px-2 py-1 hover-elevate active-elevate-2"
      data-testid={testid}
    >
      {copied ? <><CheckIcon className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> {label}</>}
    </button>
  );
}
