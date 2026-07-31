"use client";
import { getRisk } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

const LIMIT_LABELS: Record<string, string> = {
  max_notional: "최대 명목가치",
  max_order_qty: "최대 주문수량",
  max_leverage: "최대 레버리지",
  kill_switch: "킬스위치",
  require_human_approval: "사람 승인 필수",
};

export default function PortfolioRisk() {
  const { data, err, loading } = useConsole(getRisk);
  const live = data?.autonomy.live_execution_enabled;
  return (
    <div className="min-h-full">
      <PageHeader kicker="PORTFOLIO OS" title="리스크"
        right={<Badge tone="hud">거버너 · 드라이런</Badge>} />
      <div className="p-5 space-y-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="거버너" value="가동중" tone="pos" accent="pos" sub="드라이런" />
            <StatTile label="익스포저" value={(data?.capital.exposure_pct ?? 0).toFixed(1)} unit="%" tone="hud" accent="hud" />
            <StatTile label="자율도" value={`L${data?.autonomy.level ?? "?"}`} unit={`/ L${data?.autonomy.min_live ?? "?"}`} tone={live ? "pos" : "warn"} accent={live ? "pos" : "warn"} />
            <StatTile label="집행 리스크 이벤트" value={data?.execution_risk_events ?? 0} accent="info" />
          </div>
          <Panel>
            <PanelHead kicker="LIMITS" title="리스크 한도 (RiskGovernor)" />
            <div className="p-4">
              {Object.entries(data?.limits ?? {}).map(([k, v]) => (
                <KV key={k} k={LIMIT_LABELS[k] ?? k} v={typeof v === "boolean" ? (v ? "ON" : "off") : String(v)} />
              ))}
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
