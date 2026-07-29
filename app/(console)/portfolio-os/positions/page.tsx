"use client";
import { getPositions } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, DataTable } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";

export default function Positions() {
  const { data, err, loading } = useConsole(getPositions);
  const rows = data?.positions ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="PORTFOLIO OS" title="Positions"
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.count ?? 0} open</span>} />
      <div className="p-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err} empty={!rows.length} emptyNote={data?.note ?? "오픈 포지션 없음"}>
          <Panel className="overflow-hidden">
            <PanelHead kicker="PAPER" title="Open Positions" />
            <DataTable rows={rows} keyFn={(r, i) => String((r as Record<string, unknown>).strategy_id ?? i)}
              cols={[
                { key: "strategy_id", label: "Strategy", render: (r) => <span className="text-[var(--c-text-1)]">{String((r as Record<string, unknown>).strategy_id ?? "—")}</span> },
                { key: "quantity", label: "Qty", align: "r" },
                { key: "average_price", label: "Avg", align: "r" },
                { key: "market_value", label: "Value", align: "r" },
                { key: "unrealized_pnl", label: "uPnL", align: "r", render: (r) => { const v = (r as Record<string, unknown>).unrealized_pnl as number; return v != null ? <span className={v >= 0 ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]"}>{v.toFixed(2)}</span> : "—"; } },
              ]} />
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
