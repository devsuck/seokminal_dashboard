"use client";
// P95 — Jarvis Investment Research OS v1.0. Market Intelligence 통합 운영 화면.
// Market State → Opportunities → Experiments → Validation → Risk → Portfolio → Decision Queue → Knowledge.
// /console/market-cockpit. READ ONLY · 관찰·발견·평가·설명·사람 의사결정 지원. 절대 거래·배분·승인 없음.
import { getMarketCockpit, type MarketCockpitResp } from "@/lib/console-api";
import { PageHeader, useConsole, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Meter } from "@/components/console/primitives";

const CONF: Record<string, "pos" | "hud" | "warn"> = { HIGH: "pos", MEDIUM: "hud", LOW: "warn" };
const num = (n: number | undefined | null, d = 0) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: d }));

export default function MarketIntelligence() {
  const { data, err, loading } = useConsole<MarketCockpitResp>((s) => getMarketCockpit(s), [], 60000);
  return (
    <div className="min-h-full">
      <PageHeader kicker="P95 · v1.0" title="Market Intelligence"
        right={data && <Badge tone={data.market_state?.regime === "UNKNOWN" ? "mute" : "hud"}>{data.market_state?.regime}</Badge>} />
      <StateBlock loading={loading} err={err}>
        {data && (
          <div className="p-5 space-y-5">
            {/* 흐름 순서: Market State */}
            <Panel hud>
              <PanelHead kicker="P87 · Market State" title="Current Regime"
                right={data.market_state?.confidence != null && <Badge tone="hud">conf {num(data.market_state.confidence, 2)}</Badge>} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1.5">Regime labels</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(data.market_state?.labels ?? []).map((l) => <Badge key={l} tone="hud">{l}</Badge>)}
                    {(data.market_state?.labels ?? []).length === 0 && <span className="text-[11px] text-[var(--c-text-3)]">시장 지표 미제공 — UNKNOWN(정직)</span>}
                  </div>
                  <div className="mt-3 text-[9px] tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-1.5">Historical matches</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(data.market_state?.historical_similar_periods ?? []).map((p) => <Badge key={p.period} tone="blue">{p.period}</Badge>)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-pos)] uppercase mb-1.5">Recommended research</div>
                  {(data.market_state?.recommended_research ?? []).map((r, i) => <div key={i} className="text-[11px] text-[var(--c-text-2)]">· {r}</div>)}
                  {(data.market_state?.recommended_research ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.2em] text-[var(--c-warn)] uppercase mb-1.5">Avoid</div>
                  {(data.market_state?.avoid ?? []).map((r, i) => <div key={i} className="text-[11px] text-[var(--c-warn)]">· {r}</div>)}
                  {(data.market_state?.avoid ?? []).length === 0 && <div className="text-[10px] text-[var(--c-text-3)]">—</div>}
                </div>
              </div>
            </Panel>

            {/* KPI 흐름 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="Opportunities" value={(data.research_opportunities?.length ?? 0) + (data.top_opportunities?.length ?? 0)} accent="pos" />
              <StatTile label="Validation Health" value={num(data.validation_status?.health, 1)} accent="hud" sub={`${num(data.validation_status?.incomplete)} incomplete`} />
              <StatTile label="Open Risks" value={num(data.risk?.total_failures)} accent="warn" tone="warn" sub={`top ${data.risk?.top_category ?? "—"}`} />
              <StatTile label="Decision Queue" value={data.decision_queue?.length ?? 0} accent="info" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Opportunities (P88) */}
              <Panel>
                <PanelHead kicker="P88" title="Research Opportunities" right={<Badge tone="pos">{data.research_opportunities?.length ?? 0}</Badge>} />
                <div className="p-4 space-y-2">
                  {(data.research_opportunities ?? []).length === 0 && (data.top_opportunities ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">이상 신호가 감지되면 연구 아이디어가 나타납니다(트레이드 신호 아님).</div>}
                  {(data.research_opportunities ?? []).map((o, i) => (
                    <div key={`d${i}`} className="c-panel-2 p-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-[11.5px] font-medium text-[var(--c-text-1)]">{o.title}</span><Badge tone={CONF[o.confidence] ?? "mute"}>{o.confidence}</Badge></div>
                      <div className="text-[10px] text-[var(--c-text-3)] mt-1">{o.suggested_hypothesis}</div>
                    </div>
                  ))}
                  {(data.top_opportunities ?? []).map((o, i) => (
                    <div key={`q${i}`} className="flex items-center justify-between gap-2 c-panel-2 p-2.5">
                      <span className="text-[11.5px] text-[var(--c-text-1)] truncate">{o.name}</span>
                      <div className="flex gap-1.5"><Badge tone={CONF[o.expected_value] ?? "mute"}>EV {o.expected_value}</Badge><Badge tone={CONF[o.confidence] ?? "mute"}>{o.confidence}</Badge></div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Validation + Risk + Portfolio */}
              <div className="space-y-4">
                <Panel>
                  <PanelHead kicker="Validation" title="Coverage" right={<Badge tone="hud">{num(data.validation_status?.health, 1)}</Badge>} />
                  <div className="p-4 space-y-2">
                    {Object.entries(data.validation_status?.coverage ?? {}).map(([k, v]) => (
                      <div key={k}><div className="flex justify-between text-[10.5px] mb-1"><span className="text-[var(--c-text-2)]">{k}</span><span className="c-num text-[var(--c-text-3)]">{Math.round((v as number) * 100)}%</span></div><Meter value={v as number} tone="hud" /></div>
                    ))}
                  </div>
                </Panel>
                <div className="grid grid-cols-3 gap-3">
                  <StatTile label="Paper Cap" value={`$${num(data.portfolio_context?.capital)}`} />
                  <StatTile label="Exposure" value={`$${num(data.portfolio_context?.gross_exposure)}`} />
                  <StatTile label="Knowledge" value={num(data.knowledge_growth?.total)} sub={`${num(data.knowledge_growth?.graph_nodes)} nodes`} />
                </div>
                <Panel>
                  <PanelHead kicker="Decision" title="Decision Queue" right={<Badge tone="warn">{data.decision_queue?.length ?? 0}</Badge>} />
                  <div className="p-4 space-y-1">
                    {(data.decision_queue ?? []).length === 0 && <div className="text-[11px] text-[var(--c-text-3)]">검토 대기 없음.</div>}
                    {(data.decision_queue ?? []).map((d) => <div key={d.run_id} className="text-[11px] text-[var(--c-text-2)] truncate">· {d.request}</div>)}
                  </div>
                </Panel>
              </div>
            </div>
            <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">{data.disclaimer}</div>
          </div>
        )}
      </StateBlock>
    </div>
  );
}
