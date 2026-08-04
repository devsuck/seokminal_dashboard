"use client";
// P181-200 — Autonomous Research Discovery & Validation Loop v3.0.
// Cycle status · Opportunity discovery · Hypothesis board · Experiment queue · Validation · Ranking · Human review queue.
// /console/autonomous-research. READ ONLY · 연구 자동화 ON · 실행 OFF · 자동 백테스트 없음 · WAITING_HUMAN 유지.
import { useCallback, useEffect, useRef, useState } from "react";
import { getAutonomousResearch, type AutonomousResearchResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const LIFECYCLE = ["CREATED", "OBSERVING", "DISCOVERING", "GENERATING", "PRIORITIZING",
  "WAITING_HUMAN", "EXTERNAL_VALIDATION", "ANALYZING", "LEARNING", "COMPLETED"];
const EXAMPLES = [
  "Does momentum work in KR equities?",
  "한국 소형주에서 유동성 계절성이 있는가?",
  "암호화폐 오더플로우로 단기 방향성을 예측할 수 있는가?",
];

export default function AutonomousDiscovery() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<AutonomousResearchResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const run = useCallback(async (query: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setErr(null);
    try { const d = await getAutonomousResearch(query, ctrl.signal); if (!ctrl.signal.aborted) setData(d); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErr((e as Error).message); }
    finally { if (!ctrl.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); return () => abortRef.current?.abort(); }, [run]);
  const submit = (text: string) => { setQ(text); run(text); };

  const cyc = data?.cycle_status;
  const rel = data?.release;
  const lv = data?.loop_validation;
  const pa = data?.production_audit;
  const curIdx = cyc ? LIFECYCLE.indexOf(cyc.state) : -1;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P181-200 · Autonomous Research OS v3.0" title="자율 탐색 루프"
        right={rel && <div className="flex gap-1.5">
          <Badge tone={rel.production_ready ? "pos" : "warn"}>{rel.status}</Badge>
          <Badge tone="neg">실행 {rel.execution}</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        <Panel hud className="p-5">
          <div className="text-[13px] font-semibold text-[var(--c-text-1)]">어떤 질문으로 자율 탐색 사이클을 돌려볼까요?</div>
          <div className="mt-1 text-[11px] text-[var(--c-text-3)] leading-relaxed">
            연구 질문을 입력하면 기회 탐색 → 가설 생성 → 우선순위화 사이클을 실행합니다. WAITING_HUMAN 체크포인트에서 항상 멈추며, 사람 승인 없이는 자동 백테스트·실행으로 진행되지 않습니다.
          </div>
          <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="mt-3 flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 한국 소형주에서 유동성 계절성이 있는가?"
              className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3.5 h-11 text-[13px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 h-11 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--c-bg)] bg-[var(--c-hud)] cursor-pointer disabled:opacity-50 disabled:cursor-wait">
              {loading && <span className="h-3 w-3 rounded-full border-2 border-[color-mix(in_srgb,var(--c-bg)_40%,transparent)] border-t-[var(--c-bg)] animate-spin" />}
              {loading ? "실행 중…" : "사이클 실행"}
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
        {loading && !data && (
          <div className="flex items-center justify-center py-16 gap-2 text-[var(--c-text-3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-hud)] animate-pulse" />
            <span className="text-[11px] tracking-wider">로딩 중…</span>
          </div>
        )}

        {data && (
          <>
            {/* Cycle lifecycle rail */}
            <Panel>
              <PanelHead kicker="P181 · 리서치 사이클" title="라이프사이클 상태"
                right={cyc && <Badge tone={cyc.human_checkpoint_pending ? "warn" : "hud"}>{cyc.state}</Badge>} />
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1">
                  {LIFECYCLE.map((s, i) => (
                    <div key={s} className="flex items-center">
                      <span className={`text-[9px] px-2 py-1 border ${i === curIdx ? "border-[var(--c-warn)] text-[var(--c-warn)] bg-[color-mix(in_srgb,var(--c-warn)_10%,transparent)]" : i < curIdx ? "border-[color-mix(in_srgb,var(--c-pos)_40%,transparent)] text-[var(--c-pos)]" : "border-[var(--c-border)] text-[var(--c-text-3)]"}`}>{s}</span>
                      {i < LIFECYCLE.length - 1 && <span className="text-[var(--c-text-3)] mx-0.5">›</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-[var(--c-text-3)]">
                  auto_backtest: <span className="text-[var(--c-neg)]">{String(cyc?.auto_backtest)}</span> · WAITING_HUMAN 체크포인트에서 정지 — 사람 승인 없이 외부 검증 진입 불가.
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="기회" value={String(data.opportunities.count)} sub={`${Object.keys(data.opportunities.by_type).length}개 유형`} tone="hud" />
              <StatTile label="가설" value={String(data.hypotheses.count)} sub={`${data.hypotheses.with_why_different}건 차별점`} tone="pos" />
              <StatTile label="검토 큐" value={String(data.experiment_queue.queue_size)} sub="사람 체크포인트" tone="warn" />
              <StatTile label="루프/감사" value={lv?.validated && pa?.audited ? "통과" : "검토 필요"} sub={`원장 ${pa?.ledger_count ?? "—"} · 중복 ${pa?.duplicate_logic.length ?? 0}`} tone={lv?.validated && pa?.audited ? "pos" : "warn"} />
            </div>

            {/* Opportunities (P182) */}
            <Panel>
              <PanelHead kicker="P182 · 기회 탐색" title="리서치 기회 (신호 아님)"
                right={<Badge tone="hud">{data.opportunities.count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.opportunities.items.map((o) => (
                  <div key={o.opportunity_id} className="c-panel-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{o.observation}</span>
                      <div className="flex gap-1"><Badge tone="mute">{o.type}</Badge><Badge tone="neg">신호 아님</Badge></div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {o.possible_questions.map((qq, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)]">? {qq}</div>)}
                    </div>
                    <div className="text-[9px] c-num text-[var(--c-text-3)] mt-1">신뢰도 {o.confidence.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Hypothesis board (P183) */}
            <Panel>
              <PanelHead kicker="P183 · 가설 보드 (회상 우선)" title="리서치 가설"
                right={<Badge tone="hud">{data.hypotheses.count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.hypotheses.items.map((h) => (
                  <div key={h.hypothesis_id} className="c-panel-2 p-3">
                    <div className="text-[11.5px] text-[var(--c-text-1)]">{h.question}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>참신성 {h.novelty.toFixed(2)}</span>
                      <span>신뢰도 {h.confidence.toFixed(2)}</span>
                      <span className={h.past_failures > 0 ? "text-[var(--c-warn)]" : ""}>과거 실패 {h.past_failures}</span>
                    </div>
                    <div className="text-[9.5px] text-[var(--c-text-3)] mt-0.5">왜 지금: {h.why_now}</div>
                    {h.why_different_this_time && <div className="text-[9.5px] text-[var(--c-warn)] mt-0.5">왜 다른가: {h.why_different_this_time}</div>}
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Experiment queue + Human review (P186) */}
              <Panel>
                <PanelHead kicker="P186 · 사람 리서치 게이트" title="실험 큐"
                  right={<Badge tone="warn">{data.experiment_queue.queue_size}</Badge>} />
                <div className="p-4 space-y-1.5">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {data.experiment_queue.available_actions.map((a) => <Badge key={a} tone="pos">{a}</Badge>)}
                    <Badge tone="neg">실행 불가</Badge><Badge tone="neg">백테스트 실행 불가</Badge>
                  </div>
                  {data.experiment_queue.requests.map((r) => (
                    <div key={r.request_id} className="c-panel-2 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-[var(--c-text-1)] truncate">{r.question}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-hud)]">{typeof r.priority_score === "number" ? r.priority_score.toFixed(3) : r.priority_score}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">APPROVE = 외부 테스트 요청 허용, 실행 아님.</div>
                </div>
              </Panel>

              {/* Research ranking (P185) */}
              <Panel>
                <PanelHead kicker="P185 · 리서치 랭킹" title="우선순위 큐" />
                <div className="p-4 space-y-1.5">
                  {data.research_ranking.queue.map((r) => (
                    <div key={r.rank} className="c-panel-2 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] c-num text-[var(--c-text-3)] w-4">{r.rank}</span>
                        <span className="text-[10.5px] text-[var(--c-text-1)] flex-1 truncate">{r.question}</span>
                        <span className="text-[9.5px] c-num text-[var(--c-hud)]">{r.priority_score.toFixed(3)}</span>
                      </div>
                      <div className="text-[9px] text-[var(--c-text-3)] mt-0.5 pl-6 truncate">{r.why_important}</div>
                    </div>
                  ))}
                  <div className="text-[8.5px] text-[var(--c-text-3)] pt-1 c-num">{data.research_ranking.formula}</div>
                </div>
              </Panel>
            </div>

            {/* Metrics (P196) */}
            <Panel>
              <PanelHead kicker="P196 · 리서치 인텔리전스 지표" title="자율성 지표" />
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                {Object.entries(data.metrics).map(([k, v]) => (
                  <div key={k} className="c-panel-2 p-2">
                    <div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase truncate">{k}</div>
                    <div className="text-[12px] c-num text-[var(--c-text-1)]">{String(v ?? "—")}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Release + capabilities (P200) */}
            <Panel>
              <PanelHead kicker="P200 · 릴리스 v3.0" title={rel?.version || "Autonomous Research OS v3.0"}
                right={rel && <Badge tone={rel.production_ready ? "pos" : "warn"}>{rel.status}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1.5">Jarvis가 할 수 있는 것</div>
                  <div className="flex flex-wrap gap-1">{(rel?.capabilities.can ?? []).map((c) => <Badge key={c} tone="pos">{c}</Badge>)}</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-neg)] uppercase mb-1.5">Jarvis가 할 수 없는 것</div>
                  <div className="flex flex-wrap gap-1">{(rel?.capabilities.cannot ?? []).map((c) => <Badge key={c} tone="neg">✗ {c}</Badge>)}</div>
                  <div className="mt-2 text-[10px] text-[var(--c-text-3)] space-y-0.5">
                    <div>리서치 자동화: <span className="text-[var(--c-pos)]">{rel?.research_automation}</span></div>
                    <div>실행: <span className="text-[var(--c-neg)]">{rel?.execution}</span></div>
                    <div>결정 권한: <span className="text-[var(--c-hud)]">{rel?.decision_authority}</span></div>
                  </div>
                </div>
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
