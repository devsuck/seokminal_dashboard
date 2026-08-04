"use client";
// P171-180 — Autonomous Research Intelligence Enhancement.
// Creative hypotheses · search tree · continuous queue · prioritization · planning · productivity · reflection · autonomy validation.
// /console/research-intelligence. READ ONLY · 연구 자동 실행 없음 · 자율 승인 없음 · BUY/SELL/EXECUTE/ALLOCATE 없음.
import { useCallback, useEffect, useRef, useState } from "react";
import { getResearchIntelligence, type ResearchIntelligenceResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const PRIO_TONE: Record<string, "pos" | "warn" | "neg"> = { LOW: "pos", MEDIUM: "warn", HIGH: "neg" };

export default function ResearchIntelligencePlus() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<ResearchIntelligenceResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    try { const d = await getResearchIntelligence(query, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); return () => abortRef.current?.abort(); }, [run]);

  const ch = data?.creative_hypotheses;
  const cq = data?.continuous_queue;
  const ep = data?.experiment_prioritization;
  const av = data?.autonomy_validation;
  const cov = ep?.coverage_context;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P171-180 · 인텔리전스 강화" title="자율 연구 인텔리전스"
        right={av && <div className="flex gap-1.5">
          <Badge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</Badge>
          <Badge tone="hud">재사용 {av.reuse_count}</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">탐색</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="창의적 가설" value={String(ch?.count ?? 0)} sub={`소스 ${(ch?.diversity?.sources ?? []).length}개`} tone="hud" />
              <StatTile label="리서치 큐" value={String(cq?.queue_size ?? 0)} sub="상시 백로그" tone="pos" />
              <StatTile label="지식 커버리지" value={cov?.research_coverage != null ? `${Math.round(cov.research_coverage * 100)}%` : "—"} sub={`공백 ${cov?.knowledge_gap != null ? Math.round(cov.knowledge_gap * 100) : 0}%`} tone="warn" />
              <StatTile label="자율성 감사" value={av?.validated ? "통과" : "검토 필요"} sub={`중복 ${av?.duplicated_logic.length ?? 0} · 재사용 ${av?.reuse_count ?? 0}`} tone={av?.validated ? "pos" : "warn"} />
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>

            {/* Creative hypotheses (P171) */}
            <Panel>
              <PanelHead kicker="P171 · 창의적 가설 발굴" title="다중 소스 가설"
                right={ch && <Badge tone="hud">{ch.count}</Badge>} />
              <div className="p-4 space-y-2">
                {(ch?.hypotheses ?? []).slice(0, 6).map((h) => (
                  <div key={h.hypothesis_id} className="c-panel-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{h.statement}</span>
                      <Badge tone="mute">{h.source}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>참신성 {h.novelty_score.toFixed(2)}</span>
                      <span>불확실성 {h.uncertainty.toFixed(2)}</span>
                      <span>신뢰도 {h.confidence}</span>
                      <span>과거 연구 {h.similar_historical_research.prior_research_count}</span>
                      {h.similar_historical_research.tried_before && <span className="text-[var(--c-warn)]">이전 시도됨</span>}
                      <span>상충 {h.conflicting_evidence.count}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.required_validation.slice(0, 5).map((v) => <span key={v} className="text-[8.5px] px-1.5 py-0.5 border border-[var(--c-border)] text-[var(--c-text-3)]">{v}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Continuous queue (P173) */}
              <Panel>
                <PanelHead kicker="P173 · 상시 리서치 큐" title="우선순위 백로그"
                  right={cq && <Badge tone="pos">{cq.queue_size}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(cq?.by_source ?? {}).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Object.entries(cq?.by_source ?? {}).map(([s, n]) => <Badge key={s} tone="mute">{s} {n}</Badge>)}
                    </div>
                  )}
                  {(cq?.backlog ?? []).slice(0, 8).map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] c-num text-[var(--c-text-3)] w-5">{b.rank ?? i + 1}</span>
                      <span className="text-[10.5px] text-[var(--c-text-1)] flex-1 truncate">{b.statement}</span>
                      <span className="text-[9px] c-num text-[var(--c-hud)]">{typeof b.score === "number" ? b.score.toFixed(3) : ""}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Experiment prioritization (P174) */}
              <Panel>
                <PanelHead kicker="P174 · 실험 우선순위화" title="다음 추천"
                  right={<Badge tone="hud">{ep?.recommendations.length ?? 0}</Badge>} />
                <div className="p-4 space-y-1.5">
                  {(ep?.recommendations ?? []).slice(0, 6).map((r, i) => (
                    <div key={i} className="c-panel-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-[var(--c-text-1)] truncate">{r.statement}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-hud)]">{r.composite_score.toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">추천만 — 사람이 다음 실험을 결정.</div>
                </div>
              </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Planning (P177) */}
              <Panel>
                <PanelHead kicker="P177 · 기관 차원 계획" title="의제 & 로드맵" />
                <div className="p-4 space-y-2">
                  {Object.entries(data.research_planning ?? {}).map(([horizon, plan]) => (
                    <div key={horizon} className="c-panel-2 p-2.5">
                      <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1">{horizon}</div>
                      {(plan.agenda ?? []).slice(0, 3).map((a, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)] truncate">· {a.item}</div>)}
                      {(plan.roadmap ?? []).map((r, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)] truncate">Q{r.quarter_slot}: {r.theme}</div>)}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Productivity (P179) + Reflection (P176) */}
              <Panel>
                <PanelHead kicker="P179 · 생산성 + P176 · 회고" title="지표 & 교훈" />
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.productivity?.metrics ?? {}).slice(0, 6).map(([k, m]) => (
                      <div key={k} className="c-panel-2 p-2">
                        <div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase truncate">{k}</div>
                        <div className="text-[12px] c-num text-[var(--c-text-1)]">{String(m.value ?? "—")}</div>
                      </div>
                    ))}
                  </div>
                  {(data.productivity?.recommendations ?? []).slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge tone={PRIO_TONE[r.priority] ?? "mute"}>{r.priority}</Badge>
                      <span className="text-[10px] text-[var(--c-text-2)] flex-1 truncate">{r.recommendation}</span>
                    </div>
                  ))}
                  {(data.self_reflection?.test_next ?? []).slice(0, 2).map((t, i) => (
                    <div key={`r${i}`} className="text-[10px] text-[var(--c-text-3)]">↳ 다음: {t}</div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Autonomy validation (P180) */}
            <Panel>
              <PanelHead kicker="P180 · 자율성 검증" title="안전성 & 재사용 감사"
                right={av && <Badge tone={av.validated ? "pos" : "warn"}>{av.validated ? "검증됨" : "검토 필요"}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                {(av?.checks ?? []).map((c) => (
                  <div key={c.check} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                    <span className="text-[10.5px] text-[var(--c-text-1)] flex-1">{c.check}</span>
                    <span className="text-[9px] text-[var(--c-text-3)]">{c.detail ?? ""}</span>
                  </div>
                ))}
              </div>
              {(av?.remaining_limitations ?? []).length > 0 && (
                <div className="px-4 pb-4">
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1">남은 제약사항</div>
                  {(av?.remaining_limitations ?? []).map((l, i) => <div key={i} className="text-[10px] text-[var(--c-text-3)]">· {l}</div>)}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
