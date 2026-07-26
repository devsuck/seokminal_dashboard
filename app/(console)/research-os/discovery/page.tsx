"use client";
// P181-200 — Autonomous Research Discovery & Validation Loop v3.0.
// Cycle status · Opportunity discovery · Hypothesis board · Experiment queue · Validation · Ranking · Human review queue.
// /console/autonomous-research. READ ONLY · 연구 자동화 ON · 실행 OFF · 자동 백테스트 없음 · WAITING_HUMAN 유지.
import { useCallback, useEffect, useState } from "react";
import { getAutonomousResearch, type AutonomousResearchResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const LIFECYCLE = ["CREATED", "OBSERVING", "DISCOVERING", "GENERATING", "PRIORITIZING",
  "WAITING_HUMAN", "EXTERNAL_VALIDATION", "ANALYZING", "LEARNING", "COMPLETED"];

export default function AutonomousDiscovery() {
  const [q, setQ] = useState("Does momentum work in KR equities?");
  const [data, setData] = useState<AutonomousResearchResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    setErr(null);
    try { setData(await getAutonomousResearch(query)); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { run("Does momentum work in KR equities?"); }, [run]);

  const cyc = data?.cycle_status;
  const rel = data?.release;
  const lv = data?.loop_validation;
  const pa = data?.production_audit;
  const curIdx = cyc ? LIFECYCLE.indexOf(cyc.state) : -1;
  return (
    <div className="min-h-full">
      <PageHeader kicker="P181-200 · Autonomous Research OS v3.0" title="Autonomous Discovery Loop"
        right={rel && <div className="flex gap-1.5">
          <Badge tone={rel.production_ready ? "pos" : "warn"}>{rel.status}</Badge>
          <Badge tone="neg">EXEC {rel.execution}</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="연구 질문…"
            className="flex-1 bg-[var(--c-panel-2)] border border-[var(--c-border)] px-3 h-10 text-[12.5px] text-[var(--c-text-1)] outline-none focus:border-[var(--c-hud)]" />
          <button type="submit" className="px-4 h-10 text-[11px] font-semibold uppercase text-[var(--c-hud)] border border-[color-mix(in_srgb,var(--c-hud)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-hud)_10%,transparent)] cursor-pointer">Run Cycle</button>
        </form>
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {data && (
          <>
            {/* Cycle lifecycle rail */}
            <Panel>
              <PanelHead kicker="P181 · Research Cycle" title="Lifecycle State"
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
              <StatTile label="Opportunities" value={String(data.opportunities.count)} sub={`${Object.keys(data.opportunities.by_type).length} types`} tone="hud" />
              <StatTile label="Hypotheses" value={String(data.hypotheses.count)} sub={`${data.hypotheses.with_why_different} why-different`} tone="pos" />
              <StatTile label="Review Queue" value={String(data.experiment_queue.queue_size)} sub="human checkpoint" tone="warn" />
              <StatTile label="Loop / Audit" value={lv?.validated && pa?.audited ? "PASS" : "REVIEW"} sub={`ledgers ${pa?.ledger_count ?? "—"} · dup ${pa?.duplicate_logic.length ?? 0}`} tone={lv?.validated && pa?.audited ? "pos" : "warn"} />
            </div>

            {/* Opportunities (P182) */}
            <Panel>
              <PanelHead kicker="P182 · Opportunity Discovery" title="Research Opportunities (not signals)"
                right={<Badge tone="hud">{data.opportunities.count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.opportunities.items.map((o) => (
                  <div key={o.opportunity_id} className="c-panel-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--c-text-1)]">{o.observation}</span>
                      <div className="flex gap-1"><Badge tone="mute">{o.type}</Badge><Badge tone="neg">not signal</Badge></div>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {o.possible_questions.map((qq, i) => <div key={i} className="text-[10px] text-[var(--c-text-2)]">? {qq}</div>)}
                    </div>
                    <div className="text-[9px] c-num text-[var(--c-text-3)] mt-1">confidence {o.confidence.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Hypothesis board (P183) */}
            <Panel>
              <PanelHead kicker="P183 · Hypothesis Board (recall-first)" title="Research Hypotheses"
                right={<Badge tone="hud">{data.hypotheses.count}</Badge>} />
              <div className="p-4 space-y-2">
                {data.hypotheses.items.map((h) => (
                  <div key={h.hypothesis_id} className="c-panel-2 p-3">
                    <div className="text-[11.5px] text-[var(--c-text-1)]">{h.question}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[9.5px] c-num text-[var(--c-text-3)]">
                      <span>novelty {h.novelty.toFixed(2)}</span>
                      <span>conf {h.confidence.toFixed(2)}</span>
                      <span className={h.past_failures > 0 ? "text-[var(--c-warn)]" : ""}>past_failures {h.past_failures}</span>
                    </div>
                    <div className="text-[9.5px] text-[var(--c-text-3)] mt-0.5">why now: {h.why_now}</div>
                    {h.why_different_this_time && <div className="text-[9.5px] text-[var(--c-warn)] mt-0.5">why different: {h.why_different_this_time}</div>}
                  </div>
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Experiment queue + Human review (P186) */}
              <Panel>
                <PanelHead kicker="P186 · Human Research Gate" title="Experiment Queue"
                  right={<Badge tone="warn">{data.experiment_queue.queue_size}</Badge>} />
                <div className="p-4 space-y-1.5">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {data.experiment_queue.available_actions.map((a) => <Badge key={a} tone="pos">{a}</Badge>)}
                    <Badge tone="neg">no execute</Badge><Badge tone="neg">no run_backtest</Badge>
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
                <PanelHead kicker="P185 · Research Ranking" title="Priority Queue" />
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
              <PanelHead kicker="P196 · Research Intelligence Metrics" title="Autonomy Metrics" />
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
              <PanelHead kicker="P200 · Release v3.0" title={rel?.version || "Autonomous Research OS v3.0"}
                right={rel && <Badge tone={rel.production_ready ? "pos" : "warn"}>{rel.status}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1.5">Jarvis CAN</div>
                  <div className="flex flex-wrap gap-1">{(rel?.capabilities.can ?? []).map((c) => <Badge key={c} tone="pos">{c}</Badge>)}</div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-neg)] uppercase mb-1.5">Jarvis CANNOT</div>
                  <div className="flex flex-wrap gap-1">{(rel?.capabilities.cannot ?? []).map((c) => <Badge key={c} tone="neg">✗ {c}</Badge>)}</div>
                  <div className="mt-2 text-[10px] text-[var(--c-text-3)] space-y-0.5">
                    <div>Research Automation: <span className="text-[var(--c-pos)]">{rel?.research_automation}</span></div>
                    <div>Execution: <span className="text-[var(--c-neg)]">{rel?.execution}</span></div>
                    <div>Decision Authority: <span className="text-[var(--c-hud)]">{rel?.decision_authority}</span></div>
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
