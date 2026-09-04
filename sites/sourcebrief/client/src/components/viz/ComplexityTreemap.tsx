import type { ComplexityModule } from "@shared/schema";
import { useMemo } from "react";

/** Greedy squarified-ish treemap (good enough for ~12 items) */
function layoutTreemap(items: ComplexityModule[], width: number, height: number) {
  const total = items.reduce((a, b) => a + b.size, 0) || 1;
  const sorted = [...items].sort((a, b) => b.size - a.size);
  const rects: Array<{ m: ComplexityModule; x: number; y: number; w: number; h: number }> = [];

  let x = 0, y = 0, remW = width, remH = height;
  let row: ComplexityModule[] = [];
  let rowSum = 0;
  let horizontal = remW >= remH;

  const flushRow = () => {
    if (row.length === 0) return;
    if (horizontal) {
      const h = (rowSum / total) * (width * height) / remW;
      let cx = x;
      for (const m of row) {
        const w = (m.size / rowSum) * remW;
        rects.push({ m, x: cx, y, w, h });
        cx += w;
      }
      y += h; remH -= h;
    } else {
      const w = (rowSum / total) * (width * height) / remH;
      let cy = y;
      for (const m of row) {
        const h = (m.size / rowSum) * remH;
        rects.push({ m, x, y: cy, w, h });
        cy += h;
      }
      x += w; remW -= w;
    }
    row = []; rowSum = 0;
    horizontal = remW >= remH;
  };

  const worst = (r: ComplexityModule[], length: number) => {
    const s = r.reduce((a, b) => a + b.size, 0);
    if (s === 0 || length === 0) return Infinity;
    const max = Math.max(...r.map((m) => m.size));
    const min = Math.min(...r.map((m) => m.size));
    const area = (length * length) * s / (total);
    return Math.max((length * length * max) / (s * s) * (total), (s * s) / (length * length * min) / (total));
    void area;
  };

  for (const m of sorted) {
    const length = horizontal ? remW : remH;
    const wWithout = worst(row, length);
    const wWith = worst([...row, m], length);
    if (row.length === 0 || wWith <= wWithout) {
      row.push(m); rowSum += m.size;
    } else {
      flushRow();
      row.push(m); rowSum += m.size;
    }
  }
  flushRow();
  return rects;
}

const COMPLEXITY_COLOR: Record<ComplexityModule["complexity"], string> = {
  high: "hsl(var(--chart-5))",
  medium: "hsl(var(--chart-4))",
  low: "hsl(var(--chart-1))",
};

export function ComplexityTreemap({ modules }: { modules: ComplexityModule[] }) {
  const W = 600, H = 340;
  const rects = useMemo(() => layoutTreemap(modules, W, H), [modules]);

  return (
    <div data-testid="viz-treemap">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Complexity treemap">
        {rects.map(({ m, x, y, w, h }, i) => (
          <g key={m.name} transform={`translate(${x} ${y})`} data-testid={`treemap-${m.name}`}>
            <rect width={w - 2} height={h - 2} rx="6" fill={COMPLEXITY_COLOR[m.complexity]} fillOpacity="0.22" stroke={COMPLEXITY_COLOR[m.complexity]} strokeOpacity="0.6" />
            {w > 70 && h > 38 && (
              <>
                <text x="10" y="20" className="text-[12px] font-semibold fill-foreground">{m.name}</text>
                <text x="10" y="36" className="text-[10px] fill-muted-foreground font-mono">{m.size} files · {m.complexity}</text>
              </>
            )}
            {w > 38 && w <= 70 && h > 24 && (
              <text x="6" y="16" className="text-[10px] fill-foreground font-mono">{m.name}</text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
        {(["high", "medium", "low"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: COMPLEXITY_COLOR[k] }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
