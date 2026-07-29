"use client";
// Investment OS — Research OS 와 완전 분리된 계층. 연구=생산, 투자=소비.
// 모두 추천/시뮬레이션 · AUTO_EXECUTION 영구 비활성 · 사람 승인 필수 · Risk/Compliance/Portfolio/Kill 우회 불가 · 실행 없음.
// /console/investment-os. READ ONLY.
import { useCallback, useEffect, useState } from "react";
import { getInvestmentOs, type InvestmentOsResp } from "@/lib/console-api";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const RUNG_LABEL: Record<string, string> = {
  PAPER: "Paper", SHADOW: "Shadow", SMALL_CAPITAL: "Small Capital",
  PRODUCTION_CANDIDATE: "Production Candidate", AUTO_EXECUTION: "Auto Execution",
};

export default function InvestmentOs() {
  const [data, setData] = useState<InvestmentOsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setErr(null);
    try { setData(await getInvestmentOs()); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { run(); }, [run]);

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

            {/* Execution ladder — AUTO 잠금 */}
            <Panel>
              <PanelHead kicker="Execution Layer" title="Readiness Ladder"
                right={<Badge tone="neg">auto_execution: {String(ladder?.auto_execution_enabled)}</Badge>} />
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1">
                  {(ladder?.rungs ?? []).map((r, i) => {
                    const isAuto = r === "AUTO_EXECUTION";
                    return (
                      <div key={r} className="flex items-center">
                        <span className={`text-[10px] px-2.5 py-1.5 border ${isAuto ? "border-[var(--c-neg)] text-[var(--c-neg)] bg-[color-mix(in_srgb,var(--c-neg)_10%,transparent)] line-through" : i === 0 ? "border-[var(--c-pos)] text-[var(--c-pos)]" : "border-[var(--c-border)] text-[var(--c-text-2)]"}`}>
                          {isAuto && "🔒 "}{RUNG_LABEL[r] ?? r}
                        </span>
                        {i < (ladder?.rungs.length ?? 0) - 1 && <span className="text-[var(--c-text-3)] mx-1">›</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-[10px] text-[var(--c-text-3)]">
                  각 전진에 사람 승인 필수 + 4게이트 통과. <span className="text-[var(--c-neg)]">AUTO_EXECUTION 은 영구 비활성 — 승인·게이트와 무관하게 차단.</span> Kill switch 시 전부 Paper 강제.
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
