"use client";

import type { TradeRecord } from "@/lib/api";

interface Props {
  trades: TradeRecord[];
}

const NS = 1e9;
const DAY_NS = 86400 * NS;

function holdingDays(t: TradeRecord): number | null {
  if (t.exit_ts_ns == null) return null;
  return (t.exit_ts_ns - t.entry_ts_ns) / DAY_NS;
}

function monthKey(ns: number): string {
  const d = new Date(ns / 1e6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function histogram(values: number[], bins: number): { lo: number; hi: number; count: number }[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / bins || 1;
  const result = Array.from({ length: bins }, (_, i) => ({
    lo: min + i * width,
    hi: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), bins - 1);
    result[idx].count++;
  }
  return result;
}

function Histogram({ values, label }: { values: number[]; label: string }) {
  if (values.length < 3) return <p className="text-text-3 text-xs">데이터 부족</p>;
  const bins = histogram(values, 8);
  const maxCount = Math.max(...bins.map(b => b.count));
  return (
    <div className="space-y-1">
      <p className="text-text-3 text-[10px] uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-0.5 h-16">
        {bins.map((b, i) => {
          const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
          const isPos = b.lo >= 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${b.lo.toFixed(1)}~${b.hi.toFixed(1)}: ${b.count}`}>
              <div
                className={`w-full rounded-t-sm ${isPos ? "bg-pos/60" : "bg-neg/60"}`}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-text-3 font-data">
        <span>{Math.min(...values).toFixed(1)}</span>
        <span>{Math.max(...values).toFixed(1)}</span>
      </div>
    </div>
  );
}

function streaks(trades: TradeRecord[]): { maxWin: number; maxLoss: number } {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.pnl == null) continue;
    if (t.pnl > 0) {
      curWin++; curLoss = 0;
      if (curWin > maxWin) maxWin = curWin;
    } else if (t.pnl < 0) {
      curLoss++; curWin = 0;
      if (curLoss > maxLoss) maxLoss = curLoss;
    }
  }
  return { maxWin, maxLoss };
}

export function TradeAnalyticsPanel({ trades }: Props) {
  const closed = trades.filter(t => t.pnl != null && t.exit_ts_ns != null);
  if (closed.length < 5) return null;

  const pnls = closed.map(t => t.pnl!);
  const holdings = closed.map(holdingDays).filter((d): d is number => d != null);
  const { maxWin, maxLoss } = streaks(closed);

  // Monthly PnL
  const monthly: Record<string, number> = {};
  for (const t of closed) {
    const k = monthKey(t.entry_ts_ns);
    monthly[k] = (monthly[k] ?? 0) + (t.pnl ?? 0);
  }
  const monthlyRows = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));

  const avgHold = holdings.length ? holdings.reduce((a, b) => a + b, 0) / holdings.length : null;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
      <p className="text-text-1 text-sm font-medium">거래 분석</p>

      {/* Summary row */}
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-text-3 text-[10px] uppercase tracking-wider">총 거래</p>
          <p className="text-text-1 text-sm font-data">{closed.length}</p>
        </div>
        <div>
          <p className="text-text-3 text-[10px] uppercase tracking-wider">최대 연속 수익</p>
          <p className="text-pos text-sm font-data">{maxWin}</p>
        </div>
        <div>
          <p className="text-text-3 text-[10px] uppercase tracking-wider">최대 연속 손실</p>
          <p className="text-neg text-sm font-data">{maxLoss}</p>
        </div>
        {avgHold != null && (
          <div>
            <p className="text-text-3 text-[10px] uppercase tracking-wider">평균 보유 기간</p>
            <p className="text-text-1 text-sm font-data">{avgHold.toFixed(1)}일</p>
          </div>
        )}
        <div>
          <p className="text-text-3 text-[10px] uppercase tracking-wider">총 PnL</p>
          <p className={`text-sm font-data ${pnls.reduce((a, b) => a + b, 0) >= 0 ? "text-pos" : "text-neg"}`}>
            {pnls.reduce((a, b) => a + b, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Histograms */}
      <div className="grid grid-cols-2 gap-4">
        <Histogram values={pnls} label="PnL 분포" />
        {holdings.length >= 3 && <Histogram values={holdings} label="보유 기간 분포 (일)" />}
      </div>

      {/* Monthly PnL */}
      {monthlyRows.length > 0 && (
        <div>
          <p className="text-text-3 text-[10px] uppercase tracking-wider mb-2">월별 PnL</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr>
                  {monthlyRows.map(([k]) => (
                    <th key={k} className="text-text-3 text-[10px] px-2 py-1 text-center font-normal">{k.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {monthlyRows.map(([k, v]) => (
                    <td key={k} className={`px-2 py-1 text-center font-data text-xs ${v >= 0 ? "text-pos" : "text-neg"}`}>
                      {v >= 0 ? "+" : ""}{v.toFixed(1)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
