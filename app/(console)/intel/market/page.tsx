"use client";
import { getMarket } from "@/lib/console-api";
import { useConsole, PageHeader, StateBlock } from "@/components/console/widgets";
import { Panel, PanelHead, Meter } from "@/components/console/primitives";

export default function MarketIntel() {
  const { data, err, loading } = useConsole(getMarket, [], 15000);
  const r = data?.regime;
  const name = (r?.regime ?? "UNKNOWN").toString().toUpperCase();
  const conf = r?.confidence ?? null;
  const posture = data?.posture ?? [];
  return (
    <div className="min-h-full">
      <PageHeader kicker="INTELLIGENCE" title="Market Intelligence" />
      <div className="p-5 space-y-5 max-w-[1100px]">
        <StateBlock loading={loading} err={err}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
            <Panel grid hud className="overflow-hidden p-6">
              <div className="text-[9.5px] font-semibold tracking-[0.24em] text-[var(--c-hud)] uppercase">Market Regime</div>
              <div className="mt-3 text-[38px] font-semibold tracking-tight text-[var(--c-text-1)] leading-none">{name}</div>
              <div className="mt-5">
                <div className="flex justify-between text-[10px] c-num text-[var(--c-text-2)] mb-1.5"><span>CONFIDENCE</span><span>{conf!=null?`${Math.round(conf*100)}%`:"—"}</span></div>
                <Meter value={conf ?? 0} tone="hud" />
              </div>
              <div className="mt-4 text-[11px] text-[var(--c-text-3)]">{r?.note ?? ""}</div>
            </Panel>
            <Panel className="overflow-hidden">
              <PanelHead kicker="POSTURE" title="Factor Conviction" right={<span className="text-[10px] c-num text-[var(--c-text-3)]">활성/전체</span>} />
              <div className="p-4 space-y-2.5">
                {posture.map((p) => (
                  <div key={p.factor} className="flex items-center gap-3">
                    <span className="text-[11.5px] text-[var(--c-text-1)] w-28 shrink-0">{p.factor}</span>
                    <div className="flex-1"><Meter value={p.conviction} tone={p.conviction>0?"pos":"mute"} /></div>
                    <span className="c-num text-[11px] text-[var(--c-text-2)] w-14 text-right">{p.active}/{p.total}</span>
                    <span className="c-num text-[11px] w-12 text-right" style={{color: p.conviction>0?"var(--c-pos)":"var(--c-text-3)"}}>{Math.round(p.conviction*100)}%</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </StateBlock>
      </div>
    </div>
  );
}
