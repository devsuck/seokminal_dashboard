"use client";
// Investment OS — Research OS 와 완전 분리된 계층. 연구=생산, 투자=소비.
// 모두 추천/시뮬레이션 · AUTO_EXECUTION 영구 비활성 · 사람 승인 필수 · Risk/Compliance/Portfolio/Kill 우회 불가 · 실행 없음.
// /console/investment-os. READ ONLY.
import { useCallback, useEffect, useState } from "react";
import { getInvestmentOs, advanceLadder, type InvestmentOsResp, type LadderAdvanceResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const RUNG_LABEL: Record<string, string> = {
  PAPER: "Paper", SHADOW: "Shadow", SMALL_CAPITAL: "Small Capital",
  PRODUCTION_CANDIDATE: "Production Candidate", AUTO_EXECUTION: "Auto Execution",
};
const RUNGS = ["PAPER", "SHADOW", "SMALL_CAPITAL", "PRODUCTION_CANDIDATE", "AUTO_EXECUTION"];
interface ApprovalEntry { from: string; to: string; approved: boolean; advanced: boolean; reason: string | null; ts: string }

export default function InvestmentOs() {
  const [data, setData] = useState<InvestmentOsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 승인 워크플로 상태
  const [currentRung, setCurrentRung] = useState("PAPER");
  const [reviewed, setReviewed] = useState(false);
  const [advResult, setAdvResult] = useState<LadderAdvanceResp | null>(null);
  const [history, setHistory] = useState<ApprovalEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setErr(null);
    try { setData(await getInvestmentOs()); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { run(); }, [run]);

  const nextRung = RUNGS[Math.min(RUNGS.indexOf(currentRung) + 1, RUNGS.length - 1)];
  const nextIsAuto = nextRung === "AUTO_EXECUTION";

  const approveAndAdvance = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const r = await advanceLadder(currentRung, true);
      setAdvResult(r);
      setHistory((h) => [{ from: currentRung, to: r.new_rung, approved: true, advanced: r.advanced,
        reason: r.blocked_reason, ts: new Date().toLocaleTimeString() }, ...h].slice(0, 8));
      if (r.advanced) { setCurrentRung(r.new_rung); setReviewed(false); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [currentRung]);

  const resetLadder = useCallback(() => {
    setCurrentRung("PAPER"); setReviewed(false); setAdvResult(null);
  }, []);

  const sep = data?.separation;
  const ladder = data?.execution_ladder;
  const weights = data?.portfolio.weights ?? {};
  const sizes = data?.position_sizing ?? {};
  return (
    <div className="min-h-full">
      <PageHeader kicker="Investment OS · Separate Layer" title="Investment OS"
        right={<div className="flex gap-1.5">
          {sep && <Badge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "SEPARATED" : "REVIEW"}</Badge>}
          <Badge tone="neg">AUTO-EXEC OFF</Badge>
        </div>} />
      <div className="p-5 space-y-5">
        {err && <div className="c-panel p-4 text-[12px] text-[var(--c-neg)]">백엔드 연결 실패: {err}</div>}

        {/* Safety banner — 미션 핵심 */}
        <div className="c-panel-2 p-3 flex flex-wrap items-center gap-2 text-[10.5px]">
          <span className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase">Guarantees</span>
          <Badge tone="pos">연구=생산 · 투자=소비</Badge>
          <Badge tone="pos">Research OS 무변경</Badge>
          <Badge tone="neg">AUTO_EXECUTION 영구 OFF</Badge>
          <Badge tone="warn">사람 승인 필수</Badge>
          <Badge tone="warn">Risk/Compliance/Portfolio/Kill 우회 불가</Badge>
          <Badge tone="mute">모두 추천/시뮬레이션 · 실행 없음</Badge>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Consumed Research" value={String(data.knowledge.consumed_candidates)} sub={`research 무변경: ${!data.knowledge.research_os_modified}`} tone="hud" />
              <StatTile label="Portfolio Positions" value={String(Object.keys(weights).length)} sub={data.portfolio.method} tone="pos" />
              <StatTile label="Compliance" value={data.compliance.compliant ? "PASS" : "FAIL"} sub={`override 불가: ${!data.compliance.human_can_override}`} tone={data.compliance.compliant ? "pos" : "neg"} />
              <StatTile label="Mandatory Gates" value={data.gates.passed ? "PASS" : "BLOCK"} sub={`bypass: ${data.gates.bypass_possible}`} tone={data.gates.passed ? "pos" : "warn"} />
            </div>

            {/* Execution ladder — 인터랙티브 승인 워크플로 */}
            <Panel>
              <PanelHead kicker="Execution Layer · Approval Workflow" title="Readiness Ladder"
                right={<Badge tone="neg">auto_execution: {String(ladder?.auto_execution_enabled)}</Badge>} />
              <div className="p-4 space-y-3">
                {/* 사다리 시각 — 현재 위치 강조 */}
                <div className="flex flex-wrap items-center gap-1">
                  {RUNGS.map((r, i) => {
                    const isAuto = r === "AUTO_EXECUTION";
                    const isCurrent = r === currentRung;
                    const isPast = RUNGS.indexOf(r) < RUNGS.indexOf(currentRung);
                    return (
                      <div key={r} className="flex items-center">
                        <span className={`text-[10px] px-2.5 py-1.5 border ${
                          isAuto ? "border-[var(--c-neg)] text-[var(--c-neg)] bg-[color-mix(in_srgb,var(--c-neg)_10%,transparent)] line-through"
                          : isCurrent ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_14%,transparent)] font-semibold"
                          : isPast ? "border-[color-mix(in_srgb,var(--c-pos)_40%,transparent)] text-[var(--c-pos)]"
                          : "border-[var(--c-border)] text-[var(--c-text-3)]"}`}>
                          {isAuto && "🔒 "}{isCurrent && "▶ "}{RUNG_LABEL[r] ?? r}
                        </span>
                        {i < RUNGS.length - 1 && <span className="text-[var(--c-text-3)] mx-1">›</span>}
                      </div>
                    );
                  })}
                </div>

                {/* 게이트 상태(승인 전 확인) */}
                <div className="c-panel-2 p-3">
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-hud)] uppercase mb-1.5">Mandatory Gates (우회 불가)</div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {(advResult?.gates ?? []).length > 0
                      ? advResult!.gates.map((g) => (
                        <div key={g.gate} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: g.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                          <span className="text-[10px] text-[var(--c-text-1)]">{g.gate}</span>
                        </div>))
                      : ["risk", "compliance", "portfolio", "kill_switch"].map((g) => (
                        <div key={g} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: data.gates.passed ? "var(--c-pos)" : "var(--c-warn)" }} />
                          <span className="text-[10px] text-[var(--c-text-1)]">{g}</span>
                        </div>))}
                  </div>
                </div>

                {/* 승인 컨트롤 */}
                <div className="c-panel-2 p-3 space-y-2.5">
                  {nextIsAuto ? (
                    <div className="text-[11px] text-[var(--c-neg)] flex items-center gap-2">
                      🔒 <span>다음 단계는 <b>AUTO_EXECUTION</b> — 영구 비활성. 승인·게이트와 무관하게 전진 불가.</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-[11px] text-[var(--c-text-2)]">
                        현재 <span className="text-[var(--c-hud)] font-semibold">{RUNG_LABEL[currentRung]}</span> → 다음 <span className="text-[var(--c-text-1)] font-semibold">{RUNG_LABEL[nextRung]}</span>. 승인은 실행이 아니라 준비도 상태 전이(자문).
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)}
                          className="accent-[var(--c-hud)] w-3.5 h-3.5" />
                        <span className="text-[10.5px] text-[var(--c-text-2)]">Risk·Compliance·Portfolio 게이트와 시나리오를 검토했으며, 이 전진을 승인합니다.</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button onClick={approveAndAdvance} disabled={!reviewed || busy}
                          className={`px-4 h-9 text-[11px] font-semibold uppercase border cursor-pointer transition-colors ${
                            reviewed && !busy ? "text-[var(--c-pos)] border-[color-mix(in_srgb,var(--c-pos)_45%,transparent)] bg-[color-mix(in_srgb,var(--c-pos)_12%,transparent)]"
                            : "text-[var(--c-text-3)] border-[var(--c-border)] cursor-not-allowed opacity-50"}`}>
                          {busy ? "검증 중…" : `승인 & 전진 → ${RUNG_LABEL[nextRung]}`}
                        </button>
                        <button onClick={resetLadder} className="px-3 h-9 text-[10px] uppercase text-[var(--c-text-3)] border border-[var(--c-border)] cursor-pointer">Paper 로 리셋</button>
                      </div>
                    </>
                  )}
                  {advResult && (
                    <div className={`text-[10.5px] ${advResult.advanced ? "text-[var(--c-pos)]" : "text-[var(--c-warn)]"}`}>
                      {advResult.advanced ? `✓ 승인됨 — ${RUNG_LABEL[advResult.new_rung]} 로 전진(게이트 통과 + 사람 승인).`
                        : `✗ 차단됨 — ${advResult.blocked_reason}`}
                    </div>
                  )}
                </div>

                {/* 승인 이력(세션) */}
                {history.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase">Approval Log (this session)</div>
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9.5px] c-num text-[var(--c-text-3)]">
                        <span className="w-16">{h.ts}</span>
                        <Badge tone={h.advanced ? "pos" : "neg"}>{h.advanced ? "ADVANCED" : "BLOCKED"}</Badge>
                        <span>{RUNG_LABEL[h.from]} → {RUNG_LABEL[h.to]}</span>
                        {!h.advanced && <span className="text-[var(--c-warn)] truncate">{h.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-[var(--c-text-3)]">
                  각 전진에 사람 승인 필수 + 4게이트 통과. <span className="text-[var(--c-neg)]">AUTO_EXECUTION 은 영구 비활성 — 승인·게이트와 무관하게 차단.</span> 승인은 주문/실행이 아니라 준비도 상태 전이(자문). Kill switch 시 전부 Paper 강제.
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Portfolio (recommendation) */}
              <Panel>
                <PanelHead kicker="Portfolio Construction" title="Recommended Weights" right={<Badge tone="mute">추천 · 실배분 아님</Badge>} />
                <div className="p-4 space-y-1.5">
                  {Object.entries(weights).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">소비할 연구 후보 없음 — 지식 축적 필요.</div>}
                  {Object.entries(weights).map(([sid, w]) => (
                    <div key={sid} className="flex items-center gap-2">
                      <span className="text-[10.5px] text-[var(--c-text-1)] w-52 truncate">{sid}</span>
                      <div className="flex-1 h-1.5 bg-[var(--c-border)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w * 100}%`, background: "var(--c-hud)" }} /></div>
                      <span className="text-[10px] c-num text-[var(--c-text-3)] w-12 text-right">{(w * 100).toFixed(1)}%</span>
                      <span className="text-[9px] c-num text-[var(--c-text-3)] w-24 text-right">{(sizes[sid] ?? 0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="text-[9px] text-[var(--c-text-3)] pt-1">우측 금액 = position sizing 추천(notional 1M 기준). 자본 배분/집행 아님.</div>
                </div>
              </Panel>

              {/* Risk + scenario + exposure */}
              <Panel>
                <PanelHead kicker="Risk & Scenario" title="Budget · Stress" right={data?.risk_budget && <Badge tone={data.risk_budget.within_budget ? "pos" : "warn"}>{data.risk_budget.within_budget ? "within budget" : "over cap"}</Badge>} />
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="c-panel-2 p-2"><div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">Max Weight</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{((data.exposure.max_weight ?? 0) * 100).toFixed(0)}%</div></div>
                    <div className="c-panel-2 p-2"><div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">Positions</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{data.exposure.n_positions ?? 0}</div></div>
                    <div className="c-panel-2 p-2"><div className="text-[8.5px] tracking-[0.15em] text-[var(--c-text-3)] uppercase">HHI</div><div className="text-[13px] c-num text-[var(--c-text-1)]">{(data.exposure.herfindahl ?? 0).toFixed(2)}</div></div>
                  </div>
                  <div className="c-panel-2 p-2.5">
                    <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-0.5">Worst Scenario</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--c-text-1)]">{data.scenarios.scenario ?? "—"}</span>
                      <span className="text-[11px] c-num text-[var(--c-neg)]">{((data.scenarios.portfolio_impact_pct ?? 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="text-[9px] c-num text-[var(--c-text-3)]">est PnL {(data.scenarios.estimated_pnl ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="text-[9px] text-[var(--c-text-3)]">{data.risk_budget.summary}</div>
                </div>
              </Panel>
            </div>

            {/* Separation invariants — 미션 핵심 */}
            <Panel>
              <PanelHead kicker="Architectural Separation" title="Research OS ⟂ Investment OS ⟂ Execution"
                right={sep && <Badge tone={sep.separated ? "pos" : "warn"}>{sep.separated ? "SEPARATED" : "REVIEW"}</Badge>} />
              <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                {(sep?.invariants ?? []).map((i) => (
                  <div key={i.check} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: i.ok ? "var(--c-pos)" : "var(--c-neg)" }} />
                    <span className="text-[10.5px] text-[var(--c-text-1)]">{i.check}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </>
        )}
      </div>
    </div>
  );
}
