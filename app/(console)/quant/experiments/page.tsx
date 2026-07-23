"use client";
import { useState } from "react";
import { getStrategies, getStrategyDetail, type StrategyRow, type StrategyDetail } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock, StatusPill, KV } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Dot } from "@/components/console/primitives";

export default function StrategyDNA() {
  const { data, err, loading } = useConsole(getStrategies);
  const [factor, setFactor] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
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
            {rows.map((s) => <DNACard key={s.strategy_id} s={s} onClick={() => setSel(s.strategy_id)} />)}
          </div>
        </StateBlock>
      </div>
      {sel && <DetailModal id={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DNACard({ s, onClick }: { s: StrategyRow; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left c-panel p-4 hover:border-[var(--c-hud)] transition-colors cursor-pointer w-full bg-transparent">
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
    </button>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, err, loading } = useConsole<StrategyDetail>((sig) => getStrategyDetail(id, sig), [id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="c-panel w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between h-11 px-4 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold tracking-[0.2em] text-[var(--c-hud)] uppercase">STRATEGY DNA</span>
            <span className="text-[13px] font-semibold text-[var(--c-text-1)] c-num">{id}</span>
          </div>
          <button onClick={onClose} className="text-[var(--c-text-3)] hover:text-[var(--c-text-1)] bg-transparent border-0 cursor-pointer text-[16px] leading-none">×</button>
        </div>
        <div className="overflow-y-auto p-4">
          <StateBlock loading={loading} err={err}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="text-[9px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase mb-2">Registry State</div>
                {data?.state ? Object.entries(data.state).slice(0, 12).map(([k, v]) =>
                  <KV key={k} k={k} v={typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v)} />) :
                  <div className="text-[11px] text-[var(--c-text-3)]">상태 없음</div>}
              </div>
              <div>
                <div className="text-[9px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase mb-2">Experiments · {data?.experiment_count ?? 0}</div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {(data?.experiments ?? []).slice(-14).reverse().map((e, i) => {
                    const r = e as Record<string, unknown>;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10.5px]">
                        <Dot tone="mute" />
                        <span className="c-num text-[var(--c-text-3)] w-16">{String(r.tf ?? "")}</span>
                        <StatusPill status={String(r.status ?? "?")} />
                        <span className="c-num text-[var(--c-text-3)] ml-auto">{String(r.timestamp ?? "").slice(0, 10)}</span>
                      </div>
                    );
                  })}
                  {!data?.experiments?.length && <div className="text-[11px] text-[var(--c-text-3)]">실험 이력 없음</div>}
                </div>
              </div>
            </div>
          </StateBlock>
        </div>
      </div>
    </div>
  );
}
