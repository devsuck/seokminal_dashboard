"use client";

import { useEffect, useState } from "react";
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

  async function loadBars() {
    setLoading(true);
    setError(null);
    try {
      const response = await getBars(instrumentId, start, end);
      setBars(response.bars);
    } catch (e) {
      setBars([]);
      setError(e instanceof ApiError ? e.message : "Failed to load bars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBars();
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
