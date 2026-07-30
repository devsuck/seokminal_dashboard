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
        title="리스크 모니터"
        right={status && <Badge tone={status.tone}>{status.label}</Badge>}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        <FinancialMetric label="익스포저" value={exposure} format="percent" size="sm" signColor unit="순" />
        <FinancialMetric label="변동성" value={volatility} format="percent" size="sm" tone="warn" />
        <FinancialMetric label="VaR (1일, 95%)" value={var95} format="percent" size="sm" tone="neg" />
        <FinancialMetric label="드로다운" value={drawdown} format="percent" size="sm" tone="neg" />
        {correlation !== undefined && (
          <FinancialMetric label="상관계수" value={correlation} format="ratio" precision={2} size="sm" tone="info" />
        )}
      </div>
    </Panel>
  );
}
