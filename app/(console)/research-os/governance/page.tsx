"use client";
import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";
import {
  getCouncilExpanded, type CouncilExpandedResp,
  getDecisionMemo, type DecisionMemoResp,
  getExplainability, type ExplainabilityResp, type EvidenceNode,
  getResearchGraph, type ResearchGraphResp, type KGraphNode, type KGraphEdge,
  getResearchTimeline, type TimelineResp, type TimelineEntry,
} from "@/lib/console-api";

type TabKey = "committee" | "explain" | "graph" | "timeline";
const TABS: { key: TabKey; label: string }[] = [
  { key: "committee", label: "투자위원회" },
  { key: "explain", label: "설명가능성" },
  { key: "graph", label: "지식 그래프" },
  { key: "timeline", label: "타임라인" },
];

// ---- committee/page.tsx (P93 — Human Decision Center / Investment Committee) ----
const STANCE: Record<string, string> = { SUPPORT: "var(--c-pos)", INFO: "var(--c-blue)", NEUTRAL: "var(--c-text-3)", CAUTION: "var(--c-warn)", OPPOSE: "var(--c-neg)" };
const CONF: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const EXAMPLES = [
  "모멘텀 전략을 배포해야 하는가?",
  "DART 바이백 봇 자본 배분을 늘려야 하는가?",
  "BTC 펀딩비 전략을 페이퍼에서 라이브로 전환해야 하는가?",
];

function CommitteeTab() {
  const [q, setQ] = useState("");
  const [council, setCouncil] = useState<CouncilExpandedResp | null>(null);
  const [memo, setMemo] = useState<DecisionMemoResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setLoading(true); setErr(null);
    try { const [c, m] = await Promise.all([getCouncilExpanded(question), getDecisionMemo(question)]); setCouncil(c); setMemo(m); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  const submit = (text: string) => { setQ(text); run(text); };
  return (
    <div className="min-h-full">
      <PageHeader kicker="P93" title="투자 위원회" right={memo?.confidence && <Badge tone={CONF[memo.confidence] ?? "mute"}>{memo.confidence}</Badge>} />
      <div className="p-5 space-y-4">
        <Panel hud className="p-5">
          <div className="text-[13px] font-semibold text-[var(--c-text-1)]">어떤 논제를 심의할까요?</div>
          <div className="mt-1 text-[11px] text-[var(--c-text-3)] leading-relaxed">
            투자 논제를 입력하면 7관점 협의체가 찬반 근거를 조직하고 Decision Memo 패킷을 만듭니다. 위원회는 증거만 조직할 뿐, 최종 결정·집행은 사람이 합니다.
          </div>
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 모멘텀 전략을 배포해야 하는가?"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3.5 h-11 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 h-11 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--c-bg)] bg-[var(--c-hud)] cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              {loading && <span className="h-3 w-3 rounded-full border-2 border-[color-mix(in_srgb,var(--c-bg)_40%,transparent)] border-t-[var(--c-bg)] animate-spin" />}
              {loading ? "소집 중…" : "소집"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[9.5px] text-[var(--c-text-3)] uppercase tracking-[0.14em] mr-1 self-center">예시</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => submit(ex)} disabled={loading}
                className="px-2.5 py-1 text-[10.5px] text-[var(--c-text-2)] border border-[var(--c-border)] c-panel-2 hover:border-[var(--c-hud)] hover:text-[var(--c-hud)] transition-colors disabled:opacity-40 cursor-pointer">
                {ex}
              </button>
            ))}
          </div>
        </Panel>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}
        {council && memo && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 7관점 */}
            <div className="lg:col-span-2 space-y-4">
              <Panel>
                <PanelHead kicker="P90 · 7가지 관점" title="협의회" right={<Badge tone="hud">{council.recommendation?.split("—")[0]?.trim()}</Badge>} />
                <div className="p-4 space-y-2">
                  {(council.lenses ?? []).map((ln, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5 border-b border-[var(--c-border)] last:border-0">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STANCE[ln.stance] ?? "var(--c-text-3)" }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="text-[11px] font-semibold text-[var(--c-text-1)]">{ln.lens}</span><span className="text-[9px] c-num uppercase" style={{ color: STANCE[ln.stance] ?? "var(--c-text-3)" }}>{ln.stance}</span></div>
                        <div className="text-[10.5px] text-[var(--c-text-3)]">{ln.rationale}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="위원회 패킷" title={q} />
                <div className="p-4 space-y-3">
                  <div className="text-[13px] font-medium text-[var(--c-hud)]">{memo.recommendation}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1">지지 근거</div>{(memo.supporting_arguments ?? []).map((a, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· <b>{a.lens}</b> {a.rationale}</div>)}{(memo.supporting_arguments ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}</div>
                    <div><div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">반박 근거</div>{(memo.counter_arguments ?? []).map((a, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· <b>{a.lens}</b> {a.rationale}</div>)}{(memo.counter_arguments ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}</div>
                  </div>
                </div>
              </Panel>
            </div>
            {/* 리스크·미지·이력 */}
            <div className="space-y-4">
              <Panel>
                <PanelHead kicker="리스크" title="분석" />
                <div className="p-4 space-y-1">
                  <div className="text-[11px] text-[var(--c-text-1)]">{memo.risk_summary?.label}</div>
                  <div className="text-[10.5px] text-[var(--c-text-3)]">주요 리스크: {memo.risk_summary?.main_risk} · 신뢰도 {memo.risk_summary?.confidence}</div>
                </div>
              </Panel>
              <Panel>
                <PanelHead kicker="공백" title="남은 미지수" />
                <div className="p-4 space-y-1">
                  {(memo.remaining_unknowns ?? []).length === 0 && <div className="text-[10.5px] text-[var(--c-text-3)]">—</div>}
                  {(memo.remaining_unknowns ?? []).map((u, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {u}</div>)}
                </div>
              </Panel>
              <div className="c-panel p-3 text-[10px] text-[var(--c-text-3)] leading-relaxed">
                위원회는 증거를 조직합니다. 결정·이유·시각은 사람이 입력하고 기존 감사(rwf_runs)에 기록됩니다. 엔진은 승인/집행하지 않습니다.
              </div>
            </div>
          </div>
        )}
        {loading && !council && (
          <div className="c-panel p-10 text-center flex flex-col items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)] animate-pulse" />
            <span className="text-[11px] tracking-wider text-[var(--c-text-3)]">7관점 협의체 소집 중…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- explain/page.tsx (P71 — Explainability Visualization) ----
const CONF_C = (c?: string) => (c === "HIGH" ? "var(--c-pos)" : c === "LOW" ? "var(--c-warn)" : "var(--c-hud)");

function ExplainTab() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<ExplainabilityResp | null>(null);
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (topic: string) => {
    if (!topic.trim()) return;
    setLoading(true); setErr(null);
    try { const d = await getExplainability(topic); setData(d); setSel(d.chain.length - 1); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const node: EvidenceNode | undefined = data?.chain[sel];
  return (
    <div className="min-h-full">
      <PageHeader kicker="P71" title="설명 가능성"
        right={data?.confidence && <Badge tone={data.confidence === "HIGH" ? "pos" : data.confidence === "LOW" ? "warn" : "hud"}>신뢰도 {data.confidence}</Badge>} />
      <div className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2 mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="결론을 설명할 주제… (예: momentum)"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" disabled={loading || !q.trim()}
            className="px-4 h-10 text-[11px] font-semibold tracking-wide uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-hud)_18%,transparent)] disabled:opacity-40 cursor-pointer transition-colors">
            {loading ? "…" : "설명"}
          </button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && data.chain.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 증거 사슬 그래프 */}
            <div className="lg:col-span-2">
              <Panel>
                <PanelHead kicker="증거 사슬" title="질문 → 권고" />
                <div className="p-4">
                  {data.chain.map((n, i) => {
                    const active = i === sel;
                    const isLast = i === data.chain.length - 1;
                    const c = isLast ? CONF_C(data.confidence) : "var(--c-hud)";
                    return (
                      <div key={i} className="relative">
                        <button onClick={() => setSel(i)}
                          className={`w-full text-left flex items-start gap-3 p-2.5 transition-colors cursor-pointer border ${active ? "" : "border-transparent hover:bg-[var(--c-panel-2)]"}`}
                          style={active ? { borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` } : undefined}>
                          <span className="mt-0.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c, boxShadow: active ? `0 0 8px ${c}` : "none" }} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold" style={{ color: active ? c : "var(--c-text-1)" }}>{n.stage}</div>
                            <div className="text-[10px] text-[var(--c-text-3)] truncate">{n.label}</div>
                          </div>
                        </button>
                        {!isLast && <div className="ml-[13px] h-3 w-px bg-[var(--c-border)]" />}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* 노드 상세 + 신뢰도 분해 + 반증 */}
            <div className="lg:col-span-3 space-y-4">
              {node && (
                <Panel>
                  <PanelHead kicker={`노드 ${sel + 1}/${data.chain.length}`} title={node.stage} />
                  <div className="p-4 space-y-2">
                    <div className="text-[12px] text-[var(--c-text-1)]">{node.label}</div>
                    {(node.refs ?? []).length > 0 && (
                      <div className="pt-1">
                        <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1">참조</div>
                        {node.refs!.map((r, i) => <span key={i} className="inline-block mr-1.5 mb-1 text-[10px] c-num text-[var(--c-hud)]">{r}</span>)}
                      </div>
                    )}
                  </div>
                </Panel>
              )}

              {/* 신뢰도 분해 */}
              <Panel>
                <PanelHead kicker="신뢰도" title="분해"
                  right={<Badge tone={data.confidence === "HIGH" ? "pos" : data.confidence === "LOW" ? "warn" : "hud"}>{data.confidence}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(data.confidence_breakdown ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-[var(--c-border)] last:border-0">
                      <span className="text-[10.5px] text-[var(--c-text-3)]">{k.replace(/_/g, " ")}</span>
                      <span className="text-[10.5px] c-num text-[var(--c-text-1)]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* 왜 이 결론 / 왜 틀릴 수 있나 / 대안 / 누락 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Panel>
                  <PanelHead kicker="이유" title="이 결론인 이유" />
                  <div className="p-4 text-[10.5px] text-[var(--c-text-2)] leading-relaxed">{data.why_this_conclusion}</div>
                </Panel>
                <Panel>
                  <PanelHead kicker="이유" title="틀릴 수 있는 이유" />
                  <div className="p-4 space-y-1">
                    {(data.why_it_may_be_wrong ?? []).map((w, i) => <div key={i} className="text-[10.5px] text-[var(--c-warn)]">· {w}</div>)}
                  </div>
                </Panel>
                <Panel>
                  <PanelHead kicker="대안" title="대안적 관점" />
                  <div className="p-4 space-y-1">
                    {(data.alternative_interpretations ?? []).map((a, i) => <div key={i} className="text-[10.5px] text-[var(--c-text-2)]">· {a}</div>)}
                  </div>
                </Panel>
                <Panel>
                  <PanelHead kicker="공백" title="누락된 증거" />
                  <div className="p-4 space-y-1">
                    {(data.missing_evidence ?? []).length === 0 && <div className="text-[10.5px] text-[var(--c-text-3)]">—</div>}
                    {(data.missing_evidence ?? []).map((m, i) => <div key={i} className="text-[10.5px] text-[var(--c-neg)]">· {m}</div>)}
                  </div>
                </Panel>
              </div>
              <div className="text-[10px] text-[var(--c-text-3)]">증거 사슬 — 블랙박스 결정이 아니라 추적 가능한 근거. 최종 결정은 사람.</div>
            </div>
          </div>
        )}
        {!data && !loading && (
          <div className="c-panel p-8 text-center text-[12px] text-[var(--c-text-3)]">
            주제를 입력하면 Experiment → Validation → Failure → Memory → Council → Portfolio → Risk → Recommendation 증거 사슬을 시각화합니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ---- graph/page.tsx (P79 — Research Knowledge Graph) ----
const TYPE_COL: Record<string, number> = { Strategy: 0, Experiment: 1, Failure: 2, Lesson: 3, Risk: 3, DecisionMemo: 4, MacroEvent: 0, Sector: 1, Portfolio: 4, PaperResult: 4 };
const TYPE_TONE: Record<string, string> = {
  Strategy: "var(--c-hud)", Experiment: "var(--c-blue)", Failure: "var(--c-neg)", Lesson: "var(--c-emerald)",
  Risk: "var(--c-warn)", DecisionMemo: "var(--c-warn)", MacroEvent: "var(--c-blue)", Sector: "var(--c-hud)",
  Portfolio: "var(--c-emerald)", PaperResult: "var(--c-blue)",
};
const W = 5, COLW = 240, ROWH = 30, PAD = 40;

function GraphTab() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<ResearchGraphResp | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (topic: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    try { const d = await getResearchGraph(topic, ctrl.signal); if (!ctrl.signal.aborted) { setData(d); setSel(null); } }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { run(""); return () => abortRef.current?.abort(); }, [run]);

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

// ---- timeline/page.tsx (P78 — Research Timeline) ----
const STAGE_TONE: Record<string, string> = {
  Idea: "var(--c-text-3)", Hypothesis: "var(--c-blue)", Experiment: "var(--c-hud)",
  Backtest: "var(--c-hud)", Validation: "var(--c-pos)", Failure: "var(--c-neg)",
  Lesson: "var(--c-emerald)", "Portfolio Effect": "var(--c-blue)", Risk: "var(--c-neg)",
  Paper: "var(--c-blue)", "Decision Memo": "var(--c-warn)", "Human Review": "var(--c-warn)",
  Archive: "var(--c-text-3)",
};

function TimelineTab() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<TimelineResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (topic: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    try { const d = await getResearchTimeline(topic, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { run(""); return () => abortRef.current?.abort(); }, [run]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="P78" title="리서치 타임라인"
        right={data && <Badge tone="mute">이벤트 {data.count}건</Badge>} />
      <div className="p-5 space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="전략/주제로 필터…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-9 text-[12px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-9 text-[10.5px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">필터</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            {/* 스테이지 분포 */}
            <div className="flex flex-wrap gap-1.5">
              {data.stage_order.filter((s) => data.by_stage[s]).map((s) => (
                <Badge key={s} tone="mute">{s} · {data.by_stage[s]}</Badge>
              ))}
            </div>
            <Panel>
              <PanelHead kicker="재구성됨" title="아이디어 → … → 아카이브" />
              <div className="p-4">
                {data.count === 0 && !loading && <div className="text-[11px] text-[var(--c-text-3)] py-8 text-center">원장에서 재구성할 이벤트 없음 — 연구가 기록되면 타임라인이 채워집니다.</div>}
                <div className="relative pl-4">
                  {(data.entries ?? []).map((e, i) => {
                    const c = STAGE_TONE[e.stage] ?? "var(--c-text-3)";
                    return (
                      <div key={i} className="relative pb-3">
                        <span className="absolute left-[-11px] top-1 h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                        {i < data.entries.length - 1 && <span className="absolute left-[-7px] top-3 bottom-0 w-px bg-[var(--c-border)]" />}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: c }}>{e.stage}</span>
                          <span className="text-[11px] text-[var(--c-text-1)]">{e.label || e.ref}</span>
                          <span className="text-[9px] c-num text-[var(--c-text-3)] ml-auto">{e.source} · {e.timestamp}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)]">{data.note}</div>
          </>
        )}
      </div>
    </div>
  );
}

function GovernanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === paramTab) ? (paramTab as TabKey) : "committee";
  const setTab = (k: TabKey) => router.push(`/research-os/governance?tab=${k}`);

  return (
    <div className="min-h-full">
      <div className="flex gap-1 border-b border-[var(--c-border)] px-5 pt-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 h-9 text-[11px] font-semibold uppercase tracking-wide border-b-2 -mb-px cursor-pointer whitespace-nowrap ${
              tab === t.key
                ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[var(--c-hud)]/10"
                : "border-transparent text-[var(--c-text-2)] hover:text-[var(--c-text-1)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "committee" && <CommitteeTab />}
      {tab === "explain" && <ExplainTab />}
      {tab === "graph" && <GraphTab />}
      {tab === "timeline" && <TimelineTab />}
    </div>
  );
}

export default function Governance() {
  return (
    <Suspense fallback={null}>
      <GovernanceInner />
    </Suspense>
  );
}
