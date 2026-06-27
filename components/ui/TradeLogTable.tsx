import { EmptyState } from "./EmptyState";
import type { TradeRecord } from "@/lib/api";

interface TradeLogTableProps {
  trades: TradeRecord[];
}

function pnlClass(v: number | null): string {
  return v == null ? "text-text-3" : v >= 0 ? "text-pos" : "text-neg";
}

const HEADERS = ["#", "Side", "Entry Date", "Entry Price", "Exit Date", "Exit Price", "Qty", "PnL"];

export function TradeLogTable({ trades }: TradeLogTableProps) {
  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Trade Log</span>
        {trades.length > 0 && (
          <span className="text-text-3 text-[11px]">({trades.length})</span>
        )}
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full border-collapse min-w-[640px]">
          <thead className="sticky top-0 z-10 bg-panel-2">
            <tr>
              {HEADERS.map(h => (
                <th
                  key={h}
                  className={[
                    "px-4 py-2.5 text-text-3 text-[11px] font-medium uppercase tracking-wider border-b border-border whitespace-nowrap",
                    ["Entry Price", "Exit Price", "Qty", "PnL"].includes(h)
                      ? "text-right"
                      : "text-left",
                  ].join(" ")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState message="No trades" hint="Run backtest to see trade history" />
                </td>
              </tr>
            ) : trades.map((t, i) => {
              const entryDate = new Date(t.entry_ts_ns / 1e6).toISOString().slice(0, 10);
              const exitDate = t.exit_ts_ns
                ? new Date(t.exit_ts_ns / 1e6).toISOString().slice(0, 10)
                : "—";
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-panel-2 transition-colors">
                  <td className="px-4 py-2.5 text-text-3 font-data text-xs">{i + 1}</td>
                  <td className={`px-4 py-2.5 font-data text-xs font-medium ${t.side === "LONG" ? "text-pos" : "text-warn"}`}>
                    {t.side}
                  </td>
                  <td className="px-4 py-2.5 text-text-2 font-data text-xs">{entryDate}</td>
                  <td className="px-4 py-2.5 text-text-1 font-data text-xs text-right">{t.entry_price.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data text-xs">{exitDate}</td>
                  <td className="px-4 py-2.5 text-text-1 font-data text-xs text-right">{t.exit_price?.toFixed(2) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-2 font-data text-xs text-right">{t.qty.toFixed(0)}</td>
                  <td className={`px-4 py-2.5 font-data text-xs font-semibold text-right ${pnlClass(t.pnl)}`}>
                    {t.pnl != null ? (t.pnl >= 0 ? "+" : "") + t.pnl.toFixed(2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
