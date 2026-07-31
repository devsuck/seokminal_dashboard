"use client";
// P79 — Research Knowledge Graph. 기존 memory_graph/relationship_graph + 원장 결합 다개체 그래프.
// /console/research-graph. READ ONLY 시각화 · 새 그래프 엔진 없음.
import { useState, useCallback, useEffect, useMemo } from "react";
import { getResearchGraph, type ResearchGraphResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, Badge } from "@/components/console/primitives";

const TYPE_COL: Record<string, number> = { Strategy: 0, Experiment: 1, Failure: 2, Lesson: 3, Risk: 3, DecisionMemo: 4, MacroEvent: 0, Sector: 1, Portfolio: 4, PaperResult: 4 };
const TYPE_TONE: Record<string, string> = {
  Strategy: "var(--c-hud)", Experiment: "var(--c-blue)", Failure: "var(--c-neg)", Lesson: "var(--c-emerald)",
  Risk: "var(--c-warn)", DecisionMemo: "var(--c-warn)", MacroEvent: "var(--c-blue)", Sector: "var(--c-hud)",
  Portfolio: "var(--c-emerald)", PaperResult: "var(--c-blue)",
};
const W = 5, COLW = 240, ROWH = 30, PAD = 40;

export default function KnowledgeGraph() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<ResearchGraphResp | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (topic: string) => {
    setLoading(true); setErr(null);
    try { const d = await getResearchGraph(topic); setData(d); setSel(null); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { run(""); }, [run]);

  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number }> = {};
    if (!data) return p;
    const colCount: number[] = [0, 0, 0, 0, 0];
    for (const n of data.nodes) {
      const col = TYPE_COL[n.type] ?? 2;
      p[n.id] = { x: PAD + col * COLW, y: PAD + colCount[col] * ROWH };
      colCount[col]++;
    }
    return p;
  }, [data]);

  const height = data ? Math.max(300, PAD * 2 + Math.max(...[0, 1, 2, 3, 4].map((c) => data.nodes.filter((n) => (TYPE_COL[n.type] ?? 2) === c).length)) * ROWH) : 300;
  const adj = useMemo(() => sel && data ? new Set(data.edges.filter((e) => e.source === sel || e.target === sel).flatMap((e) => [e.source, e.target])) : null, [sel, data]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="P79" title="지식 그래프"
        right={data && <Badge tone="hud">{data.node_count} · {data.edge_count}</Badge>} />
      <div className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="주제로 필터…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-9 text-[12px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-9 text-[10.5px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">필터</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.node_types).map(([t, n]) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-[10px] text-[var(--c-text-2)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: TYPE_TONE[t] ?? "var(--c-text-3)" }} />{t} {n}
                </span>
              ))}
              <span className="text-[10px] text-[var(--c-text-3)] ml-2">엣지: {Object.entries(data.edge_kinds).map(([k, n]) => `${k}(${n})`).join(" · ")}</span>
            </div>
            <Panel>
              <PanelHead kicker="읽기 전용" title="Experiment · Strategy · Failure · Lesson · Risk · Event" />
              <div className="p-2 overflow-x-auto">
                <svg width={PAD * 2 + W * COLW} height={height} className="min-w-full">
                  {data.edges.map((e, i) => {
                    const a = pos[e.source], b = pos[e.target]; if (!a || !b) return null;
                    const active = !adj || (adj.has(e.source) && adj.has(e.target));
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--c-border)" strokeWidth={active ? 1 : 0.4} opacity={active ? 0.6 : 0.15} />;
                  })}
                  {data.nodes.map((n) => {
                    const p = pos[n.id]; if (!p) return null;
                    const c = TYPE_TONE[n.type] ?? "var(--c-text-3)";
                    const dim = adj && !adj.has(n.id);
                    return (
                      <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSel(sel === n.id ? null : n.id)} style={{ cursor: "pointer", opacity: dim ? 0.25 : 1 }}>
                        <circle r={4} fill={c} />
                        <text x={7} y={3.5} fontSize={9.5} fill="var(--c-text-2)" className="c-num">{n.label.slice(0, 24)}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)]">{data.note} · 노드 클릭 → 연결 강조.</div>
          </>
        )}
      </div>
    </div>
  );
}
