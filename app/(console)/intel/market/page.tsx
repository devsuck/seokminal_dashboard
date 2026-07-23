"use client";
import { getMarket } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, Meter } from "@/components/console/primitives";

export default function MarketIntel() {
  const { data, err, loading } = useConsole(getMarket);
  const r = data?.regime;
  const name = (r?.regime ?? "UNKNOWN").toString().toUpperCase();
  const conf = r?.confidence ?? null;
  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="Market Intelligence" />
      <div className="p-5 max-w-[900px]">
        <StateBlock loading={loading} err={err}>
          <Panel grid hud className="overflow-hidden p-6">
            <div className="text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-hud)] uppercase">Market Regime</div>
            <div className="mt-3 text-[40px] font-semibold tracking-tight text-[var(--c-text-1)] leading-none">{name}</div>
            <div className="mt-5 max-w-sm">
              <div className="flex justify-between text-[10px] c-num text-[var(--c-text-2)] mb-1.5"><span>CONFIDENCE</span><span>{conf != null ? `${Math.round(conf * 100)}%` : "—"}</span></div>
              <Meter value={conf ?? 0} tone="hud" />
            </div>
            <div className="mt-4 text-[11px] text-[var(--c-text-3)]">{r?.note ?? ""}</div>
          </Panel>
        </StateBlock>
      </div>
    </div>
  );
}
