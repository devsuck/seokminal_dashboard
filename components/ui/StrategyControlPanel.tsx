"use client";

import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { TIMEFRAMES, BENCHMARKS } from "@/lib/backtest-types";

interface StrategyControlPanelProps {
  instrumentId: string;
  onInstrumentChange: (v: string) => void;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  timeframe: string;
  onTimeframeChange: (v: string) => void;
  benchmarkId: string;
  onBenchmarkChange: (v: string) => void;
  onRun: () => void;
  loading: boolean;
  children?: React.ReactNode;
}

export function StrategyControlPanel({
  instrumentId, onInstrumentChange,
  start, end, onStartChange, onEndChange,
  timeframe, onTimeframeChange,
  benchmarkId, onBenchmarkChange,
  onRun, loading,
  children,
}: StrategyControlPanelProps) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">종목</span>
          <InstrumentSelect value={instrumentId} onChange={onInstrumentChange} />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">기간</span>
          <DateRangePicker start={start} end={end} onStartChange={onStartChange} onEndChange={onEndChange} />
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">주기</span>
          <div className="flex gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={[
                  "px-2.5 py-1 text-xs rounded border cursor-pointer transition-all duration-100",
                  timeframe === tf
                    ? "bg-panel-2 text-accent border-accent/40 font-medium": "bg-transparent text-text-3 border-border hover:text-text-2 hover:border-border",
                ].join(" ")}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Benchmark */}
        <div className="flex items-center gap-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">벤치마크</span>
          <select value={benchmarkId} onChange={e => onBenchmarkChange(e.target.value)}>
            {BENCHMARKS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        {/* RUN button */}
        <button
          onClick={onRun}
          disabled={loading}
          className="ml-auto px-5 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-0">
          {loading ? "실행 중…" : "실행"}
        </button>
      </div>

      {/* Mode-specific extra controls */}
      {children}
    </div>
  );
}
