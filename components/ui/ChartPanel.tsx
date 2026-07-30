import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "./EmptyState";
import type { BarOut, TradeRecord } from "@/lib/api";
import { specLabel, type ChartIndicatorSpec } from "@/lib/backtest-types";

interface ChartPanelProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  symbol: string;
  timeframe: string;
  /** 조건식에 쓰인 지표 — 차트에 오버레이/서브페인으로 표시 + 헤더 칩. */
  specs?: ChartIndicatorSpec[];
}

export function ChartPanel({ bars, trades = [], symbol, timeframe, specs }: ChartPanelProps) {
  const hasData = bars.length > 0;

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-panel-2 flex-wrap">
        <span className="font-data text-sm text-text-1 font-medium">{symbol}</span>
        <span className="text-text-3 text-xs bg-panel border border-border px-2 py-0.5 rounded">{timeframe}</span>
        <div className="flex items-center gap-3 ml-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="text-pos text-sm leading-none">▲</span>
            <span className="text-text-3">매수</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-neg text-sm leading-none">▼</span>
            <span className="text-text-3">매도</span>
          </span>
        </div>
        {specs && specs.length > 0 && (
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {specs.map((s, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-accent/30 text-accent bg-accent/5 font-data">
                {specLabel(s)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chart or placeholder */}
      {hasData ? (
        <CandlestickChart bars={bars} trades={trades} specs={specs} />
      ) : (
        <div className="h-[480px] bg-panel flex items-center justify-center">
          <EmptyState message="백테스트를 실행하면 차트가 표시됩니다" hint="위에서 종목, 기간, 전략 파라미터를 선택하세요" />
        </div>
      )}
    </div>
  );
}
