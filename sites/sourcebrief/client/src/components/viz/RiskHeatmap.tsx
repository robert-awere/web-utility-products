import type { RiskItem, OpportunityItem } from "@shared/schema";
import { useState } from "react";
import { ShieldAlert, Sparkles } from "lucide-react";

type Item =
  | ({ kind: "risk" } & RiskItem)
  | ({ kind: "opp" } & OpportunityItem);

export function RiskHeatmap({ risks, opportunities }: { risks: RiskItem[]; opportunities: OpportunityItem[] }) {
  const [tab, setTab] = useState<"risk" | "opp">("risk");
  const items: Item[] =
    tab === "risk"
      ? risks.map((r) => ({ kind: "risk" as const, ...r }))
      : opportunities.map((o) => ({ kind: "opp" as const, ...o }));

  const W = 520, H = 320, pad = 40;
  // Risk: x = severity (1..5), y = impact (1..5)
  // Opp: x = effort (1..5), y = upside (1..5)
  const xAxisLabel = tab === "risk" ? "Severity →" : "Effort →";
  const yAxisLabel = tab === "risk" ? "↑ Impact" : "↑ Upside";

  return (
    <div data-testid="viz-risk-heatmap">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setTab("risk")}
            className={`px-3 py-1 text-xs rounded-md inline-flex items-center gap-1.5 transition ${tab === "risk" ? "bg-destructive/15 text-destructive font-medium" : "text-muted-foreground hover-elevate"}`}
            data-testid="tab-risks"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Risks · {risks.length}
          </button>
          <button
            type="button"
            onClick={() => setTab("opp")}
            className={`px-3 py-1 text-xs rounded-md inline-flex items-center gap-1.5 transition ${tab === "opp" ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover-elevate"}`}
            data-testid="tab-opportunities"
          >
            <Sparkles className="h-3.5 w-3.5" /> Opportunities · {opportunities.length}
          </button>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
          plotted on a {tab === "risk" ? "severity × impact" : "effort × upside"} grid
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Risk/opportunity heatmap">
            {/* Grid */}
            {[1, 2, 3, 4, 5].map((g) => (
              <g key={g}>
                <line x1={pad + ((W - pad * 2) / 5) * (g - 1)} y1={pad} x2={pad + ((W - pad * 2) / 5) * (g - 1)} y2={H - pad} stroke="hsl(var(--border))" strokeOpacity="0.5" />
                <line x1={pad} y1={pad + ((H - pad * 2) / 5) * (g - 1)} x2={W - pad} y2={pad + ((H - pad * 2) / 5) * (g - 1)} stroke="hsl(var(--border))" strokeOpacity="0.5" />
              </g>
            ))}
            <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke="hsl(var(--border))" />
            {/* Quadrant tint */}
            <rect x={W / 2} y={pad} width={W / 2 - pad} height={(H - pad * 2) / 2} fill={tab === "risk" ? "hsl(var(--destructive))" : "hsl(var(--primary))"} fillOpacity="0.06" />
            {/* Axis labels */}
            <text x={W - pad} y={H - 10} textAnchor="end" className="text-[10px] fill-muted-foreground font-mono">{xAxisLabel}</text>
            <text x={10} y={pad + 12} className="text-[10px] fill-muted-foreground font-mono">{yAxisLabel}</text>

            {items.map((it, i) => {
              const x = tab === "risk" ? (it as RiskItem).severity : (it as OpportunityItem).effort;
              const y = tab === "risk" ? (it as RiskItem).impact : (it as OpportunityItem).upside;
              const cx = pad + ((x - 0.5) / 5) * (W - pad * 2);
              const cy = H - pad - ((y - 0.5) / 5) * (H - pad * 2);
              const color = tab === "risk" ? "hsl(var(--destructive))" : "hsl(var(--primary))";
              return (
                <g key={i} data-testid={`heatmap-point-${i}`}>
                  <circle cx={cx} cy={cy} r="14" fill={color} fillOpacity="0.18" />
                  <circle cx={cx} cy={cy} r="6" fill={color} />
                  <text x={cx + 10} y={cy + 3} className="text-[10px] fill-foreground">{i + 1}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <ol className="space-y-2.5">
          {items.map((it, i) => {
            const color = tab === "risk" ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5";
            return (
              <li key={i} className={`rounded-lg border p-3 ${color}`} data-testid={`item-${tab}-${i}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`h-6 w-6 shrink-0 rounded-full grid place-items-center text-[11px] font-semibold ${tab === "risk" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{it.title}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.area}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{it.rationale}</div>
                  </div>
                </div>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="text-sm text-muted-foreground" data-testid="empty-risks">Nothing flagged here.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
