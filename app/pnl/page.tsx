"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRealizedPnl, type VenuePnl } from "@/lib/api";
import { PageHeader, StateBlock, DataTable, StatusPill } from "@/components/console/widgets";
import { Panel, PanelHead, StatTile, Badge, Dot } from "@/components/console/primitives";

const fmtTs = (ts: string) => ts.replace("T", " ").slice(0, 19);
const fmtPnl = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
const pnlCls = (v: number) => (v > 0 ? "text-[var(--c-pos)]" : v < 0 ? "text-[var(--c-neg)]" : "text-[var(--c-text-3)]");

function VenuePanel({ v }: { v: VenuePnl }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead kicker="VENUE" title={v.venue}
        right={<span className="text-[10px] c-num text-[var(--c-text-3)]">체결 {v.trades.length}건</span>} />
      <div className="grid grid-cols-3 divide-x divide-[var(--c-border)] border-b border-[var(--c-border)]">
        {[
          ["총 실현손익", v.gross_realized_pnl, true],
          ["수수료(추정)", -v.fees, false],
          ["순 실현손익", v.net_realized_pnl, true],
        ].map(([label, val, color]) => (
          <div key={String(label)} className="p-3.5">
            <div className="text-[9.5px] tracking-[0.14em] text-[var(--c-text-3)] uppercase">{label as string}</div>
            <div className={`c-num text-[18px] font-semibold mt-1 ${color ? pnlCls(val as number) : "text-[var(--c-text-2)]"}`}>
              {fmtPnl(val as number)}
            </div>
          </div>
        ))}
      </div>

      {v.unpriced_fills > 0 && (
        <div className="px-4 py-2 text-[11px] text-[var(--c-warn)] bg-[color-mix(in_srgb,var(--c-warn)_10%,transparent)] border-b border-[var(--c-border)] flex items-center gap-2">
          <Dot tone="warn" /> 체결가 미확인 {v.unpriced_fills}건 — 손익 계산 제외
        </div>
      )}

      {v.open_positions.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--c-border)]">
          <div className="text-[9.5px] tracking-[0.14em] text-[var(--c-text-3)] uppercase mb-1.5">보유 포지션</div>
          <div className="space-y-1 c-num text-[11.5px]">
            {v.open_positions.map((p) => (
              <div key={p.symbol} className="flex gap-3 text-[var(--c-text-1)]">
                <span className="w-24 shrink-0">{p.symbol}</span>
                <span className="text-[var(--c-text-3)]">{p.qty} @ {p.avg_price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.trades.length > 0 && (
        <DataTable
          rows={v.trades}
          keyFn={(_, i) => String(i)}
          cols={[
            { key: "ts", label: "Time", render: (t) => <span className="c-num text-[var(--c-text-3)]">{fmtTs(t.ts)}</span> },
            { key: "symbol", label: "Symbol", render: (t) => <span className="c-num text-[var(--c-text-1)]">{t.symbol}</span> },
            { key: "side", label: "Side", render: (t) => <span className={`c-num ${t.side === "buy" ? "text-[var(--c-pos)]" : "text-[var(--c-neg)]"}`}>{t.side}</span> },
            { key: "qty", label: "Qty", align: "r", render: (t) => `${t.qty}` },
            { key: "price", label: "Price", align: "r", render: (t) => (
              <span>{t.price}{t.price_source === "estimated" && <span className="ml-1 text-[9px] text-[var(--c-warn)]" title="주문가 추정">추정</span>}</span>
            ) },
            { key: "realized_pnl", label: "PnL", align: "r", render: (t) => (
              <span className={t.realized_pnl == null ? "text-[var(--c-text-3)]" : pnlCls(t.realized_pnl)}>
                {t.realized_pnl == null ? "—" : fmtPnl(t.realized_pnl)}
              </span>
            ) },
          ]}
        />
      )}
    </Panel>
  );
}

export default function RealizedPnlPage() {
  const [venues, setVenues] = useState<VenuePnl[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    getRealizedPnl(c.signal)
      .then((d) => { if (!c.signal.aborted) { setVenues(d.venues); setLoading(false); } })
      .catch((e) => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  const totalNet = (venues ?? []).reduce((s, v) => s + v.net_realized_pnl, 0);
  const totalGross = (venues ?? []).reduce((s, v) => s + v.gross_realized_pnl, 0);
  const totalFees = (venues ?? []).reduce((s, v) => s + v.fees, 0);
  const totalTrades = (venues ?? []).reduce((s, v) => s + v.trades.length, 0);

  return (
    <div className="min-h-full">
      <PageHeader kicker="TRADING DESK" title="Realized PnL"
        right={<Badge tone={totalNet >= 0 ? "pos" : "neg"}>{fmtPnl(totalNet)} NET</Badge>} />
      <div className="p-5 space-y-5 max-w-[1200px]">
        <StateBlock loading={loading} err={error} empty={!!venues && venues.length === 0} emptyNote="체결된 주문 없음 (OMS 기록 기반 FIFO 매칭)">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Net Realized" value={fmtPnl(totalNet)} tone={totalNet >= 0 ? "pos" : "neg"} accent={totalNet >= 0 ? "pos" : "neg"} />
            <StatTile label="Gross Realized" value={fmtPnl(totalGross)} accent="hud" />
            <StatTile label="Fees (est)" value={`-${totalFees.toFixed(2)}`} tone="warn" accent="warn" />
            <StatTile label="Trades" value={totalTrades} accent="info" />
          </div>
          <div className="space-y-5">
            {(venues ?? []).map((v) => <VenuePanel key={v.venue} v={v} />)}
          </div>
          <div className="text-[10px] text-[var(--c-text-3)] leading-relaxed">
            OMS 체결 FIFO 매칭. KR 체결가는 브로커 미제공 → 주문가 추정(<span className="text-[var(--c-warn)]">추정</span> 배지).
            수수료는 설정 bps 추정값(<span className="c-num">PNL_FEE_BPS_*</span>, 기본 0).
          </div>
        </StateBlock>
      </div>
    </div>
  );
}
