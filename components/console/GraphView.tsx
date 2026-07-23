"use client";

import { useMemo, useState } from "react";
import type { GraphNode, GraphEdge } from "@/lib/console-api";

const STATUS_COLOR: Record<string, string> = {
  live: "#10B981", micro_live: "#10B981", constrained_live: "#10B981",
  paper_active: "#22D3EE", live_candidate: "#22D3EE", candidate: "#22D3EE",
  watchlist: "#3B82F6", draft: "#4E5A68", analysis: "#3B82F6",
  rejected: "#FF4D4D", blocked_by_data: "#F5B301", underpowered: "#F5B301", weak: "#F5B301",
};
const col = (s?: string) => STATUS_COLOR[s ?? ""] ?? "#4E5A68";

interface Placed { node: GraphNode; x: number; y: number; r: number }

export function GraphView({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [hover, setHover] = useState<Placed | null>(null);
  const W = 1000, H = 680, CX = W / 2, CY = H / 2;

  const { placed, lines, factorPts } = useMemo(() => {
    const factors = nodes.filter((n) => n.type === "factor");
    const byFactor: Record<string, GraphNode[]> = {};
    nodes.filter((n) => n.type === "strategy").forEach((n) => {
      (byFactor[n.factor ?? "?"] ??= []).push(n);
    });
    const N = Math.max(factors.length, 1);
    const Rf = 200;
    const pos: Record<string, Placed> = {};
    const fpts: Placed[] = [];
    factors.forEach((f, i) => {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
      const fx = CX + Rf * Math.cos(ang), fy = CY + Rf * Math.sin(ang);
      const p: Placed = { node: f, x: fx, y: fy, r: 8 + Math.min(14, (f.count ?? 1)) };
      pos[f.id] = p; fpts.push(p);
      const kids = byFactor[f.label] ?? [];
      const rLeaf = Math.min(95, 34 + kids.length * 3.2);
      kids.forEach((k, j) => {
        const a = (j / Math.max(kids.length, 1)) * Math.PI * 2;
        pos[k.id] = { node: k, x: fx + rLeaf * Math.cos(a), y: fy + rLeaf * Math.sin(a), r: 4 };
      });
    });
    const ln = edges.map((e) => ({ a: pos[e.source], b: pos[e.target] })).filter((x) => x.a && x.b);
    return { placed: Object.values(pos), lines: ln, factorPts: fpts };
  }, [nodes, edges]);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: "72vh" }}>
        {/* edges */}
        {lines.map((l, i) => (
          <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
            stroke="var(--c-border-2)" strokeWidth={0.5} strokeOpacity={0.5} />
        ))}
        {/* strategy nodes */}
        {placed.filter((p) => p.node.type === "strategy").map((p) => (
          <circle key={p.node.id} cx={p.x} cy={p.y} r={hover?.node.id === p.node.id ? 6 : p.r}
            fill={col(p.node.status)} fillOpacity={0.9}
            stroke={hover?.node.id === p.node.id ? "#E8EDF2" : "none"} strokeWidth={1}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} />
        ))}
        {/* factor hubs */}
        {factorPts.map((p) => (
          <g key={p.node.id}>
            <circle cx={p.x} cy={p.y} r={p.r} fill="var(--c-panel-3)"
              stroke="var(--c-hud)" strokeWidth={1.4} />
            <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke="var(--c-hud)" strokeWidth={0.5} strokeOpacity={0.35} />
            <text x={p.x} y={p.y - p.r - 7} textAnchor="middle" fontSize={11}
              fill="var(--c-text-1)" fontWeight={600} style={{ letterSpacing: "0.04em" }}>
              {p.node.label}
            </text>
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={9} fill="var(--c-hud)"
              fontFamily="var(--font-data)">{p.node.count}</text>
          </g>
        ))}
      </svg>
      {/* tooltip */}
      {hover && (
        <div className="absolute top-2 left-2 c-panel px-3 py-2 pointer-events-none"
          style={{ maxWidth: 260 }}>
          <div className="text-[12px] text-[var(--c-text-1)] truncate">{hover.node.label}</div>
          <div className="text-[10px] c-num text-[var(--c-text-3)] mt-0.5 flex items-center gap-2">
            <span style={{ color: col(hover.node.status) }}>● {hover.node.status}</span>
            <span>·</span><span>{hover.node.factor}</span>
          </div>
        </div>
      )}
    </div>
  );
}
