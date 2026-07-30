"use client";

import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";
import {
  TerminalHeader,
  FinancialMetric,
  TerminalTable,
  SignalBadge,
  AIInsightPanel,
  RiskMonitor,
  ResearchStatus,
} from "@/components/terminal";

// 어느 기존 라우트에도 링크되지 않은 정적 쇼케이스. 데이터는 전부 하드코딩 — 컴포넌트 렌더링
// 확인/향후 통합 참고용이며 실제 API/상태관리와는 무관.

const SAMPLE_ROWS = [
  { symbol: "BTC-PERP", side: "LONG", qty: 2.4, entry: 61250.12, mark: 63120.5, pnl: 4.31 },
  { symbol: "ETH-PERP", side: "SHORT", qty: 18.0, entry: 3410.0, mark: 3382.4, pnl: 1.29 },
  { symbol: "SOL-PERP", side: "LONG", qty: 340.0, entry: 142.8, mark: 138.1, pnl: -3.29 },
  { symbol: "ES=F", side: "LONG", qty: 3.0, entry: 5312.25, mark: 5340.0, pnl: 0.52 },
];

export default function DesignSystemShowcase() {
  return (
    <div className="min-h-full">
      <PageHeader kicker="DESIGN SYSTEM" title="Terminal Kit" />

      <TerminalHeader
        marketStatus={{ label: "OPEN", tone: "pos" }}
        regime={{ label: "RISK-ON", tone: "info" }}
        exposure={{ value: 42.6 }}
        riskState={{ label: "NORMAL", tone: "pos" }}
        systemHealth={[
          { label: "Data Feed", status: "online" },
          { label: "Broker", status: "online" },
          { label: "Execution", status: "online" },
        ]}
      />

      <div className="p-5 space-y-5 max-w-[1400px]">
        <section>
          <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-2">
            FinancialMetric
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <FinancialMetric
              label="Portfolio Value"
              value={1284302}
              format="currency"
              precision={0}
              size="hero"
              className="col-span-2"
            />
            <FinancialMetric label="Return (1D)" value={2.14} format="percent" size="lg" signColor />
            <FinancialMetric label="Sharpe" value={1.86} format="ratio" size="md" tone="info" />
            <FinancialMetric label="Volatility" value={18.4} format="percent" size="md" tone="warn" />
            <FinancialMetric label="Max Drawdown" value={-9.7} format="percent" size="md" tone="neg" delta={{ value: -0.4 }} />
          </div>
        </section>

        <section>
          <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-2">
            RiskMonitor
          </div>
          <RiskMonitor
            exposure={42.6}
            volatility={18.4}
            var95={-3.2}
            drawdown={-9.7}
            correlation={0.34}
            status={{ label: "NORMAL", tone: "pos" }}
          />
        </section>

        <section>
          <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-2">
            SignalBadge
          </div>
          <div className="flex flex-wrap gap-3">
            <SignalBadge signal="BUY" confidence={0.82} severity="high" timestamp={Date.now() - 120000} />
            <SignalBadge signal="SELL" confidence={0.64} severity="medium" timestamp={Date.now() - 3600000} />
            <SignalBadge signal="WATCH" confidence={0.41} severity="low" timestamp={Date.now() - 86400000} />
            <SignalBadge signal="NEUTRAL" timestamp={Date.now() - 5000} />
          </div>
        </section>

        <section>
          <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-2">
            AIInsightPanel
          </div>
          <AIInsightPanel
            agent="Research Agent"
            summary="BTC funding compressed to 3-week low while spot OI expanded — asymmetric setup for a squeeze."
            reasoning={[
              "Funding rate: 0.004% (30d avg 0.012%)",
              "OI +14% over 72h while price range-bound",
              "Similar compression preceded the 2026-05 move",
            ]}
            confidence={0.71}
            timestamp={Date.now() - 900000}
          />
        </section>

        <section>
          <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-2">
            ResearchStatus
          </div>
          <ResearchStatus
            title="Pipeline"
            items={[
              { label: "Data Agent", status: "ONLINE", detail: "12ms" },
              { label: "Research Agent", status: "RUNNING", detail: "run #482" },
              { label: "Validation", status: "PASSED", detail: "BH-FDR" },
              { label: "Execution", status: "LOCKED", detail: "paper only" },
            ]}
          />
        </section>

        <section>
          <div className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase mb-2">
            TerminalTable (sortable)
          </div>
          <Panel className="overflow-hidden">
            <PanelHead kicker="DEMO" title="Positions" />
            <TerminalTable
              rows={SAMPLE_ROWS}
              keyFn={(r) => r.symbol}
              defaultSort={{ key: "pnl", dir: "desc" }}
              columns={[
                { key: "symbol", label: "Symbol", sortable: true },
                { key: "side", label: "Side" },
                { key: "qty", label: "Qty", align: "r", sortable: true },
                { key: "entry", label: "Entry", align: "r", sortable: true },
                { key: "mark", label: "Mark", align: "r", sortable: true },
                {
                  key: "pnl",
                  label: "PnL %",
                  align: "r",
                  sortable: true,
                  render: (r) => (
                    <span style={{ color: r.pnl >= 0 ? "var(--c-pos)" : "var(--c-neg)" }}>
                      {r.pnl >= 0 ? "+" : ""}
                      {r.pnl.toFixed(2)}%
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}
