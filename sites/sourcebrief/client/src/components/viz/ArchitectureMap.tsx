import type { ArchitectureNode, ArchitectureEdge } from "@shared/schema";
import { useMemo } from "react";

/**
 * Compact custom SVG node graph. Lays out nodes in 3 vertical bands:
 * (left) external/user · (middle) ui/api/service/module · (right) data/external services.
 */

const KIND_COLOR: Record<ArchitectureNode["kind"], string> = {
  entry: "hsl(var(--chart-1))",
  module: "hsl(var(--chart-2))",
  service: "hsl(var(--chart-1))",
  data: "hsl(var(--chart-3))",
  external: "hsl(var(--chart-5))",
  ui: "hsl(var(--chart-2))",
};

export function ArchitectureMap({ nodes, edges }: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] }) {
  const layout = useMemo(() => {
    const left: ArchitectureNode[] = [];
    const mid: ArchitectureNode[] = [];
    const right: ArchitectureNode[] = [];
    nodes.forEach((n) => {
      if (n.kind === "external" && n.id === "user") left.push(n);
      else if (n.kind === "data" || n.kind === "external") right.push(n);
      else mid.push(n);
    });
    const width = 760;
    const height = Math.max(260, Math.max(left.length, mid.length, right.length) * 90 + 80);
    const cols: { x: number; nodes: ArchitectureNode[] }[] = [
      { x: 80, nodes: left },
      { x: width / 2, nodes: mid },
      { x: width - 80, nodes: right },
    ];
    const positions = new Map<string, { x: number; y: number }>();
    cols.forEach((col) => {
      const n = col.nodes.length;
      const gap = (height - 40) / Math.max(n, 1);
      col.nodes.forEach((node, i) => {
        positions.set(node.id, { x: col.x, y: 40 + gap * (i + 0.5) });
      });
    });
    return { positions, width, height };
  }, [nodes]);

  return (
    <div className="w-full overflow-x-auto" data-testid="viz-architecture">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="w-full min-w-[640px]" role="img" aria-label="Architecture map">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" />
          </marker>
          <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="hsl(var(--border))" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" opacity="0.6" />

        {edges.map((e, i) => {
          const a = layout.positions.get(e.from);
          const b = layout.positions.get(e.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const path = `M ${a.x + 70} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 70} ${b.y}`;
          return (
            <g key={i}>
              <path d={path} stroke="hsl(var(--muted-foreground))" strokeOpacity="0.5" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />
              {e.label && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 6}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground font-mono"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {nodes.map((n) => {
          const pos = layout.positions.get(n.id);
          if (!pos) return null;
          const color = KIND_COLOR[n.kind];
          return (
            <g key={n.id} transform={`translate(${pos.x - 70} ${pos.y - 24})`} data-testid={`node-${n.id}`}>
              <rect width="140" height="48" rx="10" fill="hsl(var(--card))" stroke={color} strokeOpacity="0.7" strokeWidth="1.5" />
              <rect x="0" y="0" width="4" height="48" rx="2" fill={color} />
              <text x="14" y="20" className="text-[11px] font-semibold fill-foreground">
                {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
              </text>
              <text x="14" y="36" className="text-[9px] fill-muted-foreground font-mono">
                {n.kind}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {Object.entries({ ui: "UI", service: "Service", data: "Data", module: "Module", external: "External" }).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k as ArchitectureNode["kind"]] }} />
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
