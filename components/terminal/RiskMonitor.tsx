"use client";

import { Panel, PanelHead, Badge } from "@/components/console/primitives";
import { FinancialMetric } from "./FinancialMetric";
import type { Tone } from "./tokens";

export interface RiskMonitorProps {
  exposure: number; // net exposure, %
  volatility: number; // annualized vol, %
  var95: number; // 1-day VaR, % of NAV
  drawdown: number; // current drawdown from peak, %
  correlation?: number; // portfolio correlation to benchmark, -1..1
  status?: { label: string; tone: Tone }; // e.g. NORMAL / ELEVATED / BREACH
  className?: string;
}

export function RiskMonitor({
  exposure,
  volatility,
  var95,
  drawdown,
  correlation,
  status,
  className = "",
}: RiskMonitorProps) {
  return (
    <Panel className={className}>
      <PanelHead
        kicker="P&R"
        title="Risk Monitor"
        right={status && <Badge tone={status.tone}>{status.label}</Badge>}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        <FinancialMetric label="Exposure" value={exposure} format="percent" size="sm" signColor unit="net" />
        <FinancialMetric label="Volatility" value={volatility} format="percent" size="sm" tone="warn" />
        <FinancialMetric label="VaR (1D, 95%)" value={var95} format="percent" size="sm" tone="neg" />
        <FinancialMetric label="Drawdown" value={drawdown} format="percent" size="sm" tone="neg" />
        {correlation !== undefined && (
          <FinancialMetric label="Correlation" value={correlation} format="ratio" precision={2} size="sm" tone="info" />
        )}
      </div>
    </Panel>
  );
}
