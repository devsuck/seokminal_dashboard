"use client";
import { useState } from "react";
import { getStrategies, type StrategyRow } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile } from "@/components/console/primitives";

export default function StrategyDNA() {
  const { data, err, loading } = useConsole(getStrategies);
  const [factor, setFactor] = useState<string | null>(null);
  const rows = (data?.strategies ?? []).filter((s) => !factor || s.factor === factor);
  const factors = Object.entries(data?.by_factor ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-full">
      <PageHeader kicker="QUANT LAB" title="Strategy DNA"
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">{data?.total ?? 0} strategies</span>} />
      <div className="p-5 space-y-5 max-w-[1400px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Total" value={data?.total ?? 0} tone="hud" accent="hud" />
            <StatTile label="Paper Active" value={data?.by_status?.paper_active ?? 0} tone="pos" accent="pos" />
            <StatTile label="Rejected" value={data?.by_status?.rejected ?? 0} tone="neg" accent="neg" />
            <StatTile label="Factors" value={factors.length} accent="info" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFactor(null)} className={`c-num text-[10px] px-2 py-1 border cursor-pointer transition-colors ${!factor ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)]" : "border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)]"}`}>ALL · {data?.total ?? 0}</button>
            {factors.map(([f, n]) => (
              <button key={f} onClick={() => setFactor(f)} className={`c-num text-[10px] px-2 py-1 border cursor-pointer transition-colors ${factor === f ? "border-[var(--c-hud)] text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)]" : "border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)]"}`}>{f} · {n}</button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((s) => <DNACard key={s.strategy_id} s={s} />)}
          </div>
        </StateBlock>
      </div>
    </div>
  );
}

function DNACard({ s }: { s: StrategyRow }) {
  return (
    <Panel className="p-4 hover:border-[var(--c-border-2)] transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-[var(--c-text-1)] truncate">{s.name}</div>
          <div className="text-[9.5px] c-num text-[var(--c-text-3)] mt-0.5 truncate">{s.strategy_id}</div>
        </div>
        <StatusPill status={s.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10.5px]">
        <div className="flex justify-between"><span className="text-[var(--c-text-3)]">Factor</span><span className="text-[var(--c-hud)]">{s.factor}</span></div>
        <div className="flex justify-between"><span className="text-[var(--c-text-3)]">Frozen</span><span className={`c-num ${s.frozen ? "text-[var(--c-warn)]" : "text-[var(--c-text-2)]"}`}>{s.frozen ? "YES" : "no"}</span></div>
        <div className="flex justify-between col-span-2"><span className="text-[var(--c-text-3)]">Config</span><span className="c-num text-[var(--c-text-2)] truncate ml-2">{s.config_hash || "—"}</span></div>
      </div>
    </Panel>
  );
}
