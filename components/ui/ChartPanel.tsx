import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "./EmptyState";
import type { BarOut, TradeRecord } from "@/lib/api";

interface ChartPanelProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  emaFast?: number;
  emaSlow?: number;
  symbol: string;
  timeframe: string;
  mode?: "single" | "composite";
}

export function ChartPanel({ bars, trades = [], emaFast, emaSlow, symbol, timeframe, mode }: ChartPanelProps) {
  const hasData = bars.length > 0;

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-panel-2">
        <span className="font-data text-sm text-text-1 font-medium">{symbol}</span>
        <span className="text-text-3 text-xs bg-panel border border-border px-2 py-0.5 rounded">{timeframe}</span>
        {mode === "single" && emaFast && emaSlow && (
          <div className="flex items-center gap-3 ml-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-accent" />
              <span className="text-text-3">EMA {emaFast}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 bg-info" />
              <span className="text-text-3">EMA {emaSlow}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-pos text-sm leading-none">▲</span>
              <span className="text-text-3">Buy</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-neg text-sm leading-none">▼</span>
              <span className="text-text-3">Sell</span>
            </span>
          </div>
        )}
      </div>

      {/* Chart or placeholder */}
      {hasData ? (
        <CandlestickChart bars={bars} trades={trades} emaFast={emaFast} emaSlow={emaSlow} />
      ) : (
        <div className="h-[480px] bg-panel flex items-center justify-center">
          <EmptyState message="Run backtest to see chart" hint="Select symbol, date range, and strategy parameters above" />
        </div>
      )}
    </div>
  );
}
