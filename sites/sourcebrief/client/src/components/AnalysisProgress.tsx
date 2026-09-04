import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const STAGES = [
  { id: "clone", label: "Reading repository", detail: "Fetching metadata, tree, and README" },
  { id: "stack", label: "Detecting tech stack", detail: "Manifests, dependencies, runtime signals" },
  { id: "arch", label: "Mapping architecture", detail: "Inferring entry points & service boundaries" },
  { id: "risk", label: "Extracting risks & opportunities", detail: "Tests, CI, license, hotspots, market gaps" },
  { id: "viz", label: "Generating visual intelligence", detail: "Treemap, dependency graph, prompt board" },
];

export function AnalysisProgress({ repoLabel }: { repoLabel: string }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 1, STAGES.length - 1);
      setStage(i);
      if (i === STAGES.length - 1) clearInterval(id);
    }, 800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mx-auto max-w-2xl" data-testid="region-progress">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-scan" />
        <div className="flex items-center gap-3 pb-4 border-b border-border/60">
          <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Analyzing</div>
            <div className="font-mono text-sm truncate" data-testid="text-progress-repo">{repoLabel}</div>
          </div>
        </div>

        <ol className="mt-5 space-y-3">
          {STAGES.map((s, idx) => {
            const done = idx < stage;
            const active = idx === stage;
            return (
              <li key={s.id} className="flex items-start gap-3" data-testid={`stage-${s.id}`}>
                <div
                  className={`mt-0.5 h-6 w-6 shrink-0 rounded-full grid place-items-center text-xs font-medium transition ${
                    done ? "bg-primary text-primary-foreground" : active ? "bg-primary/15 text-primary ring-2 ring-primary/40" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${active ? "" : done ? "text-muted-foreground" : "text-muted-foreground/80"}`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.detail}</div>
                  {active && (
                    <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full w-1/2 rounded-full animate-shimmer bg-muted" />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
