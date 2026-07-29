"use client";
import { getExperiments } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill, DataTable } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile } from "@/components/console/primitives";

export default function Hypotheses() {
  const { data, err, loading } = useConsole((s) => getExperiments(80, s));
  const rows = data?.latest ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="QUANT LAB" title="Hypothesis Registry" />
      <div className="p-5 space-y-5 max-w-[1300px]">
        <StateBlock loading={loading} err={err} empty={!rows.length}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Unique Hypotheses" value={data?.unique_hypotheses ?? 0} tone="hud" accent="hud" />
            <StatTile label="Total Experiments" value={data?.total_experiments ?? 0} accent="info" />
            <StatTile label="Candidates" value={(data?.counts?.candidate ?? 0) + (data?.counts?.paper_candidate_forward_test_required ?? 0)} tone="pos" accent="pos" />
            <StatTile label="Rejected" value={data?.counts?.rejected ?? 0} tone="neg" accent="neg" />
          </div>
          <Panel className="overflow-hidden">
            <PanelHead kicker="LATEST" title="Hypothesis Status" />
            <DataTable
              rows={rows}
              keyFn={(r, i) => String((r as Record<string, unknown>).hypothesis_id ?? i)}
              cols={[
                { key: "hypothesis_id", label: "Hypothesis", render: (r) => <span className="text-[var(--c-text-1)]">{String((r as Record<string, unknown>).hypothesis_id ?? "—")}</span> },
                { key: "tf", label: "TF", render: (r) => String((r as Record<string, unknown>).tf ?? "—") },
                { key: "status", label: "Status", render: (r) => <StatusPill status={String((r as Record<string, unknown>).status ?? "?")} /> },
                { key: "net_pnl", label: "Net PnL", align: "r", render: (r) => { const v = (r as Record<string, unknown>).net_pnl as number; return v != null ? <span className={v >= 0 ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]"}>{v.toFixed(0)}</span> : "—"; } },
              ]}
            />
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
