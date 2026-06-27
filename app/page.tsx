"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "@/components/ui";
import { ApiError, getBars, type BarOut } from "@/lib/api";

export default function MarketPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
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
      const res = await getBars(instrumentId, start, end, undefined, ctrl.signal);
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
  }, []);

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Market Data</h1>
        <p className="text-text-3 text-sm mt-0.5">Price history for instruments in the catalog</p>
      </div>

      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Symbol</span>
            <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">Date</span>
            <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
          </div>
          <button
            onClick={loadBars}
            className="ml-auto px-5 h-9 bg-accent text-black text-sm font-semibold rounded-md cursor-pointer hover:brightness-110 transition-all border-0"
          >
            {loading ? "Loading…" : "Load"}
          </button>
          {!loading && bars.length > 0 && (
            <span className="text-text-3 text-xs font-data">{bars.length} bars</span>
          )}
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="font-data text-sm text-text-1 font-medium">{instrumentId}</span>
        </div>
        {bars.length > 0 ? (
          <CandlestickChart bars={bars} />
        ) : (
          <div className="h-[480px] flex items-center justify-center">
            <EmptyState message="No chart data" hint="Select a symbol and date range, then click Load" />
          </div>
        )}
      </div>
    </div>
  );
}
