"use client";
import { getExperiments } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill, DataTable } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";

export default function Backtests() {
  const { data, err, loading } = useConsole((s) => getExperiments(120, s));
  const rows = data?.recent ?? [];
  const num = (r: Record<string, unknown>, k: string) => { const v = r[k] as number; return v != null ? v : null; };
  return (
    <div className="min-h-full">
      <PageHeader kicker="QUANT LAB" title="Backtest Results"
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.total_experiments ?? 0} runs</span>} />
      <div className="p-5 max-w-[1300px]">
        <StateBlock loading={loading} err={err} empty={!rows.length}>
          <Panel className="overflow-hidden">
            <PanelHead kicker="RECENT" title="Experiment Runs" />
            <DataTable
              rows={[...rows].reverse()}
              keyFn={(r, i) => String(i)}
              cols={[
                { key: "hypothesis_id", label: "Strategy", render: (r) => <span className="text-[var(--c-text-1)]">{String((r as Record<string, unknown>).hypothesis_id ?? "—")}</span> },
                { key: "status", label: "Status", render: (r) => <StatusPill status={String((r as Record<string, unknown>).status ?? "?")} /> },
                { key: "gross_pnl", label: "Gross", align: "r", render: (r) => { const v = num(r as Record<string, unknown>, "gross_pnl"); return v != null ? v.toFixed(0) : "—"; } },
                { key: "net_pnl", label: "Net", align: "r", render: (r) => { const v = num(r as Record<string, unknown>, "net_pnl"); return v != null ? <span className={v >= 0 ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]"}>{v.toFixed(0)}</span> : "—"; } },
                { key: "timestamp", label: "When", align: "r", render: (r) => <span className="text-[var(--c-text-3)]">{String((r as Record<string, unknown>).timestamp ?? "").slice(0, 10)}</span> },
              ]}
            />
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
