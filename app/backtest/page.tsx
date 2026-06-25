"use client";

import { useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { BacktestResultCard } from "@/components/BacktestResultCard";
import { ApiError, getBacktest, type BacktestResponse } from "@/lib/api";

export default function BacktestPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-12-31");
  const [fast, setFast] = useState(10);
  const [slow, setSlow] = useState(20);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // No unmount-cleanup here (unlike the Market page's loadBars): this
  // page only fetches on an explicit "Run" click, never on mount, so
  // there's no request that could still be in flight at unmount time.
  const abortControllerRef = useRef<AbortController | null>(null);

  async function runBacktest() {
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
      const response = await getBacktest(
        instrumentId,
        start,
        end,
        fast,
        slow,
        controller.signal
      );
      setResult(response);
    } catch (e) {
      // Silently ignore abort errors (stale requests)
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      setResult(null);
      setError(e instanceof ApiError ? e.message : "Failed to run backtest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Backtest</h1>
      <div className="flex gap-4 items-center flex-wrap">
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
        />
        <label className="flex items-center gap-2">
          Fast EMA
          <input
            type="number"
            value={fast}
            onChange={(e) => setFast(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 w-20"
          />
        </label>
        <label className="flex items-center gap-2">
          Slow EMA
          <input
            type="number"
            value={slow}
            onChange={(e) => setSlow(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 w-20"
          />
        </label>
        <button
          onClick={runBacktest}
          className="bg-blue-600 text-white rounded px-4 py-2"
        >
          Run
        </button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && result && <BacktestResultCard result={result} />}
    </main>
  );
}
