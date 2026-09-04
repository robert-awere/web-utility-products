import type { RepoAnalysis } from "@shared/schema";
import { Package } from "lucide-react";

/** Radial-ish flow: center node "core" with deps arranged around it. */
export function DependencyFlow({ deps }: { deps: RepoAnalysis["dependencies"] }) {
  const top = deps.runtime.slice(0, 10);
  if (top.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8" data-testid="empty-deps">No runtime dependencies detected.</div>;
  }
  const W = 600, H = 340, cx = W / 2, cy = H / 2, r = 130;
  return (
    <div data-testid="viz-deps">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Dependency flow">
        {top.map((d, i) => {
          const angle = (i / top.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return (
            <g key={d.name}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />
              <g transform={`translate(${x} ${y})`}>
                <rect x="-58" y="-14" width="116" height="28" rx="6" fill="hsl(var(--card))" stroke="hsl(var(--chart-2))" strokeOpacity="0.5" />
                <text textAnchor="middle" y="2" className="text-[10px] font-mono fill-foreground">{d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name}</text>
                <text textAnchor="middle" y="12" className="text-[8px] font-mono fill-muted-foreground">{d.version || ""}</text>
              </g>
            </g>
          );
        })}
        <g transform={`translate(${cx} ${cy})`}>
          <circle r="36" fill="hsl(var(--primary))" fillOpacity="0.15" stroke="hsl(var(--primary))" strokeWidth="1.5" />
          <text textAnchor="middle" y="-2" className="text-[11px] font-semibold fill-foreground">core</text>
          <text textAnchor="middle" y="11" className="text-[9px] font-mono fill-muted-foreground">{deps.runtime.length} deps</text>
        </g>
      </svg>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground" data-testid="text-deps-summary">
        <span className="inline-flex items-center gap-1.5"><Package className="h-3 w-3" /> {deps.runtime.length} runtime · {deps.dev.length} dev</span>
        {deps.runtime.length > 10 && <span>showing top 10</span>}
      </div>
    </div>
  );
}
