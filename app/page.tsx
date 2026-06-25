"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { ApiError, getBars, type BarOut } from "@/lib/api";

export default function MarketPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-12-31");
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function loadBars() {
    setLoading(true);
    setError(null);

    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await getBars(instrumentId, start, end, controller.signal);
      setBars(response.bars);
    } catch (e) {
      // Silently ignore abort errors (stale requests)
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      setBars([]);
      setError(e instanceof ApiError ? e.message : "Failed to load bars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBars();

    // Cleanup: abort the current request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Market</h1>
      <div className="flex gap-4 items-center">
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
        <button
          onClick={loadBars}
          className="bg-blue-600 text-white rounded px-4 py-2"
        >
          Load
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && bars.length > 0 && (
        <CandlestickChart bars={bars} />
      )}
    </main>
  );
}
