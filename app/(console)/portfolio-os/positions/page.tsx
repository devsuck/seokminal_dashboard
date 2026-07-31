"use client";
import { getPositions } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, DataTable } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";

export default function Positions() {
  const { data, err, loading } = useConsole(getPositions);
  const rows = data?.positions ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="PORTFOLIO OS" title="포지션"
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.count ?? 0}건 보유중</span>} />
      <div className="p-5 max-w-[1200px]">
        <StateBlock loading={loading} err={err} empty={!rows.length} emptyNote={data?.note ?? "오픈 포지션 없음"}>
          <Panel className="overflow-hidden">
            <PanelHead kicker="PAPER" title="오픈 포지션" />
            <DataTable rows={rows} keyFn={(r, i) => String((r as Record<string, unknown>).strategy_id ?? i)}
              cols={[
                { key: "strategy_id", label: "전략", render: (r) => <span className="text-[var(--c-text-1)]">{String((r as Record<string, unknown>).strategy_id ?? "—")}</span> },
                { key: "quantity", label: "수량", align: "r" },
                { key: "average_price", label: "평균가", align: "r" },
                { key: "market_value", label: "평가금액", align: "r" },
                { key: "unrealized_pnl", label: "미실현손익", align: "r", render: (r) => { const v = (r as Record<string, unknown>).unrealized_pnl as number; return v != null ? <span className={v >= 0 ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]"}>{v.toFixed(2)}</span> : "—"; } },
              ]} />
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
