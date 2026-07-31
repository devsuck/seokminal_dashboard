"use client";
// P131-140 — Research Brain Workspace. Knowledge Graph / Past Research / Failures / Strategy·Company Memory / Conflicts / Lessons.
// /console/research-brain. READ ONLY · 지식 시스템 전용 · 자동 거래·집행 없음.
import { useCallback, useEffect, useMemo, useState } from "react";
import { getResearchBrain, type ResearchBrainResp, type BrainNode } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const HEALTH_TONE: Record<string, "pos" | "warn" | "neg" | "mute"> = {
  HEALTHY: "pos", FAIR: "warn", DEGRADED: "neg", EMPTY: "mute",
};
// research-chain column order for the graph layout
const COL: Record<string, number> = {
  Question: 0, Hypothesis: 1, Experiment: 2, Strategy: 2, Failure: 3, Risk: 3, Lesson: 4,
  Sector: 3, MacroEvent: 3, DecisionMemo: 4,
};
const TYPE_TONE: Record<string, string> = {
  Question: "var(--c-hud)", Hypothesis: "var(--c-blue)", Experiment: "var(--c-emerald)",
  Strategy: "var(--c-emerald)", Failure: "var(--c-neg)", Risk: "var(--c-warn)",
  Lesson: "var(--c-pos)", Sector: "var(--c-blue)", MacroEvent: "var(--c-warn)", DecisionMemo: "var(--c-text-2)",
};

export default function ResearchBrain() {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<ResearchBrainResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (t: string) => {
    setErr(null);
    try { setData(await getResearchBrain(t)); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { run(""); }, [run]);

  const kh = data?.knowledge_health;
  const layout = useMemo(() => {
    const nodes = data?.knowledge_graph.nodes ?? [];
    const colY: Record<number, number> = {};
    const pos: Record<string, { x: number; y: number; n: BrainNode }> = {};
    for (const n of nodes) {
      const c = COL[n.type] ?? 4;
      colY[c] = (colY[c] ?? 0) + 1;
      pos[n.id] = { x: 70 + c * 200, y: 40 + (colY[c] - 1) * 46, n };
    }
    return pos;
  }, [data]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="P131-140" title="리서치 브레인"
        right={kh && <Badge tone={HEALTH_TONE[kh.grade] ?? "mute"}>{kh.grade} {kh.health_score ?? ""}</Badge>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(topic); }} className="flex gap-2">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="주제 필터 (예: 모멘텀, TSMC)…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">조회</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="그래프 노드" value={data.knowledge_graph.node_count} sub="지식" tone="hud" />
              <StatTile label="교훈" value={data.lessons.length} sub="누적됨" tone="pos" />
              <StatTile label="충돌" value={data.conflicts.length} sub="모순" tone={data.conflicts.length ? "warn" : "pos"} />
              <StatTile label="지식 헬스" value={kh?.grade ?? "—"} sub={`${kh?.health_score ?? 0} / 100`} tone={HEALTH_TONE[kh?.grade ?? ""] === "neg" ? "neg" : HEALTH_TONE[kh?.grade ?? ""] === "warn" ? "warn" : "pos"} />
            </div>

            {/* Knowledge Graph */}
            <Panel>
              <PanelHead kicker="지식 그래프" title="질문 → 가설 → 실험 → 결과 → 교훈"
                right={<div className="flex gap-1.5 flex-wrap">{data.knowledge_graph.research_chain.map((c) => <span key={c} className="text-[9px] uppercase c-num text-[var(--c-text-3)]">{c}</span>)}</div>} />
              <div className="p-4 overflow-x-auto">
                {data.knowledge_graph.node_count === 0 ? (
                  <div className="text-[11px] text-[var(--c-text-3)]">연구가 축적되면 질문→가설→실험→결과→교훈 지식 그래프가 나타납니다(기존 원장 파생).</div>
                ) : (
                  <svg width={1080} height={Math.max(260, 60 + Math.max(...Object.values(layout).map((p) => p.y), 0))} className="min-w-[1080px]">
                    {data.knowledge_graph.edges.map((e, i) => {
                      const a = layout[e.source], b = layout[e.target];
                      if (!a || !b) return null;
                      return <line key={i} x1={a.x + 60} y1={a.y + 10} x2={b.x} y2={b.y + 10} stroke="var(--c-border)" strokeWidth="1" />;
                    })}
                    {Object.values(layout).map(({ x, y, n }) => (
                      <g key={n.id}>
                        <rect x={x} y={y} width={120} height={20} rx={3} fill="var(--c-panel-2)" stroke={TYPE_TONE[n.type] ?? "var(--c-border)"} strokeWidth="1" />
                        <text x={x + 6} y={y + 14} fontSize="9.5" fill="var(--c-text-1)" className="c-num">{n.label.slice(0, 16)}</text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Failure Patterns */}
              <Panel>
                <PanelHead kicker="실패 패턴" title="실패 원인" right={<Badge tone={data.failure_patterns.total_failures ? "neg" : "pos"}>{data.failure_patterns.total_failures}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.keys(data.failure_patterns.by_category).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">실패가 기록되면 분류별 패턴이 나타납니다.</div>}
                  {Object.entries(data.failure_patterns.by_category).map(([k, n]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[10.5px] text-[var(--c-text-2)] w-48">{k}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[var(--c-neg)]" style={{ width: `${Math.min(100, (n as number) * 20)}%` }} /></div>
                      <span className="text-[10px] c-num text-[var(--c-text-3)] w-6 text-right">{n}</span>
                    </div>
                  ))}
                  {data.failure_patterns.top_category && <div className="text-[10px] text-[var(--c-warn)] pt-1">최다: {data.failure_patterns.top_category}</div>}
                </div>
              </Panel>

              {/* Conflicts */}
              <Panel>
                <PanelHead kicker="충돌" title="상반된 결론" right={<Badge tone={data.conflicts.length ? "warn" : "pos"}>{data.conflicts.length}</Badge>} />
                <div className="p-4 space-y-2">
                  {data.conflicts.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">같은 주제에서 유효 vs 실패 모순이 감지되면 여기에 표시됩니다.</div>}
                  {data.conflicts.map((c, i) => (
                    <div key={i} className="c-panel-2 p-3">
                      <div className="flex items-center gap-2"><span className="text-[11.5px] font-medium text-[var(--c-text-1)]">{c.topic}</span></div>
                      <div className="flex gap-2 mt-1"><Badge tone="pos">A: {c.study_a.conclusion}</Badge><Badge tone="neg">B: {c.study_b.conclusion}</Badge>{c.period && <span className="text-[9px] c-num text-[var(--c-text-3)]">{c.period}</span>}</div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">{c.possible_explanation}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Strategy + Company Memory + Lessons */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MemoryList title="전략 메모리" kicker="전략" nodes={data.strategy_memory} tone="var(--c-emerald)" />
              <MemoryList title="기업 메모리" kicker="기업" nodes={data.company_memory} tone="var(--c-blue)" />
              <MemoryList title="교훈" kicker="학습됨" nodes={data.lessons} tone="var(--c-pos)" />
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryList({ title, kicker, nodes, tone }: { title: string; kicker: string; nodes: BrainNode[]; tone: string }) {
  return (
    <Panel>
      <PanelHead kicker={kicker} title={title} right={<Badge tone="hud">{nodes.length}</Badge>} />
      <div className="p-4 space-y-1">
        {nodes.length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">—</div>}
        {nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full shrink-0" style={{ background: tone }} />
            <span className="text-[10.5px] text-[var(--c-text-2)] truncate">{n.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
