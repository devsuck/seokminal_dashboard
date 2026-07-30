"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRealizedPnl, type VenuePnl } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/ui";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";

function fmtTs(ts: string) {
  return ts.replace("T", " ").slice(0, 19);
}

function fmtPnl(v: number) {
  const s = v.toFixed(2);
  return v > 0 ? `+${s}` : s;
}

function pnlColor(v: number) {
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
}

function VenueCard({ v }: { v: VenuePnl }) {
  // 체결 원장 running-sum → 누적 실현손익 곡선(gross)
  const pnlCurve: TSSeries[] = (() => {
    const pts = v.trades
      .filter(t => typeof t.realized_pnl === "number")
      .map(t => ({ t: Math.floor(new Date(t.ts).getTime() / 1000), pnl: t.realized_pnl as number }))
      .filter(t => Number.isFinite(t.t))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) return [];
    let run = 0;
    const points = pts.map(p => { run += p.pnl; return { time: p.t, value: Math.round(run * 100) / 100 }; });
    const last = points[points.length - 1].value;
    return [{ label: "누적 실현손익", color: last >= 0 ? TOKEN.pos : TOKEN.neg, points }];
  })();

  return (
    <Panel>
      <PanelHeader right={<span className="text-text-3">체결 {v.trades.length}건</span>}>{v.venue}</PanelHeader>
      <div className="p-4 grid grid-cols-3 gap-4 text-sm border-b border-border/50">
        <div>
          <div className="text-text-3 text-xs mb-0.5">총 실현손익</div>
          <div className={`font-data text-base ${pnlColor(v.gross_realized_pnl)}`}>{fmtPnl(v.gross_realized_pnl)}</div>
        </div>
        <div>
          <div className="text-text-3 text-xs mb-0.5">수수료(설정값, 추정)</div>
          <div className="font-data text-base text-text-2">-{v.fees.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-text-3 text-xs mb-0.5">순 실현손익</div>
          <div className={`font-data text-base font-semibold ${pnlColor(v.net_realized_pnl)}`}>{fmtPnl(v.net_realized_pnl)}</div>
        </div>
      </div>

      {v.unpriced_fills > 0 && (
        <div className="px-4 py-2 text-xs text-warn bg-warn/10 border-b border-warn/30">
          체결가 미확인 주문 {v.unpriced_fills}건 — 손익 계산에서 제외됨
        </div>
      )}

      {pnlCurve.length > 0 && (
        <div className="p-3 border-b border-border/50">
          <ChartFrame title="누적 실현손익 추이" caption="체결 원장 누적합(총액, 수수료 전)">
            <TimeSeries series={pnlCurve} height={160} yFormat={(x) => x.toFixed(0)} />
          </ChartFrame>
        </div>
      )}

      {v.open_positions.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="text-text-3 text-xs mb-1.5">보유 포지션</div>
          <div className="space-y-1 text-sm font-data">
            {v.open_positions.map(p => (
              <div key={p.symbol} className="flex gap-3 text-text-1">
                <span className="w-24 shrink-0">{p.symbol}</span>
                <span className="text-text-3">{p.qty} @ {p.avg_price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.trades.length > 0 && (
        <div className="divide-y divide-border/50 text-sm">
          {v.trades.map((t, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-3">
              <span className="text-text-3 w-40 shrink-0 font-data">{fmtTs(t.ts)}</span>
              <span className="text-text-1 w-24 shrink-0 font-data">{t.symbol}</span>
              <span className={`w-12 shrink-0 font-data ${t.side === "buy" ? "text-pos" : "text-neg"}`}>{t.side}</span>
              <span className="text-text-3 font-data w-20 shrink-0">{t.qty}주</span>
              <span className="text-text-1 font-data w-24 shrink-0">
                {t.price}
                {t.price_source === "estimated" && (
                  <span className="ml-1 text-[10px] text-warn" title="브로커 체결가 미제공 — 주문가로 추정">추정</span>
                )}
              </span>
              <span className={`font-data flex-1 text-right ${t.realized_pnl == null ? "text-text-3" : pnlColor(t.realized_pnl)}`}>
                {t.realized_pnl == null ? "—" : fmtPnl(t.realized_pnl)}
              </span>
            </div>
          ))}
        </div>
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
      .then(d => { if (!c.signal.aborted) { setVenues(d.venues); setLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-text-1 text-lg font-semibold">실현 손익</h1>
        <p className="text-text-3 text-sm mt-0.5">
          OMS 체결 기록 FIFO 매칭. KR 체결가는 브로커가 제공 안 해서 주문가로 추정 표시(<span className="text-warn">추정</span> 배지).
          수수료는 실 브로커 커미션이 아니라 설정한 bps 추정값(<span className="font-data">PNL_FEE_BPS_*</span> 환경변수, 기본 0).
        </p>
      </div>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="손익 계산 중…" />
        : !venues || venues.length === 0 ? <EmptyState message="체결된 주문 없음" />
        : <div className="space-y-4">{venues.map(v => <VenueCard key={v.venue} v={v} />)}</div>}
    </div>
  );
}
