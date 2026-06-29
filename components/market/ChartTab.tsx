"use client";

import { useEffect, useRef, useState } from "react";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "@/components/ui";
import { ApiError, getBars, type BarOut } from "@/lib/api";

interface ChartTabProps {
  symbol: string;
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChartTab({ symbol }: ChartTabProps) {
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadBars() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const res = await getBars(symbol, start, end, undefined, ctrl.signal);
      setBars(res.bars);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setBars([]);
      setError(e instanceof ApiError ? e.message : "Failed to load bars");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadBars();
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const PRESETS = [
    { label: "1M",  months: 1 },
    { label: "3M",  months: 3 },
    { label: "6M",  months: 6 },
    { label: "1Y",  months: 12 },
    { label: "3Y",  months: 36 },
    { label: "5Y",  months: 60 },
    { label: "ALL", months: 120 },
  ];

  function applyPreset(months: number) {
    const e = today();
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    const s = d.toISOString().slice(0, 10);
    setStart(s);
    setEnd(e);
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Timeframe preset buttons */}
      <div className="flex items-center gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => { applyPreset(p.months); }}
            className="px-2.5 py-1 text-xs font-medium rounded border border-border text-text-3 hover:text-text-1 hover:border-accent hover:text-accent bg-panel-2 transition-colors"
          >{p.label}</button>
        ))}
        <span className="text-border text-xs ml-2">|</span>
        <span className="text-text-3 text-[11px] uppercase tracking-wider ml-2">Custom</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button
          onClick={loadBars}
          className="px-4 h-7 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0"
        >
          {loading ? "…" : "Load"}
        </button>
        {!loading && bars.length > 0 && (
          <span className="text-text-3 text-xs font-data">{bars.length} bars</span>
        )}
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="font-data text-sm text-text-1 font-medium">{symbol}</span>
        </div>
        {bars.length > 0 ? (
          <CandlestickChart bars={bars} />
        ) : (
          <div className="h-[480px] flex items-center justify-center">
            <EmptyState message="No chart data" hint={error ? "" : "Click Load to fetch bars"} />
          </div>
        )}
      </div>
    </div>
  );
}
