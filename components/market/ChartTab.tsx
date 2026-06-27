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

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button
          onClick={loadBars}
          className="px-4 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0"
        >
          {loading ? "Loading…" : "Load"}
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
