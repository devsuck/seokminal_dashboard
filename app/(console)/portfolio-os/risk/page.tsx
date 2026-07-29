"use client";
import { getRisk } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge } from "@/components/console/primitives";

export default function PortfolioRisk() {
  const { data, err, loading } = useConsole(getRisk);
  const live = data?.autonomy.live_execution_enabled;
  return (
    <div className="min-h-full">
      <PageHeader kicker="PORTFOLIO OS" title="Risk"
        right={<Badge tone="hud">GOVERNOR · DRY-RUN</Badge>} />
      <div className="p-5 space-y-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Governor" value="ACTIVE" tone="pos" accent="pos" sub="dry-run" />
            <StatTile label="Exposure" value={(data?.capital.exposure_pct ?? 0).toFixed(1)} unit="%" tone="hud" accent="hud" />
            <StatTile label="Autonomy" value={`L${data?.autonomy.level ?? "?"}`} unit={`/ L${data?.autonomy.min_live ?? "?"}`} tone={live ? "pos" : "warn"} accent={live ? "pos" : "warn"} />
            <StatTile label="Exec Risk Events" value={data?.execution_risk_events ?? 0} accent="info" />
          </div>
          <Panel>
            <PanelHead kicker="LIMITS" title="Risk Limits (RiskGovernor)" />
            <div className="p-4">
              {Object.entries(data?.limits ?? {}).map(([k, v]) => (
                <KV key={k} k={k} v={typeof v === "boolean" ? (v ? "ON" : "off") : String(v)} />
              ))}
            </div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
