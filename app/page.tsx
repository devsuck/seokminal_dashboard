"use client";

import { useEffect, useRef, useState } from "react";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { CandlestickChart } from "@/components/CandlestickChart";
import { ApiError, getBars, type BarOut } from "@/lib/api";

const S = {
  page: { padding: 20 },
  header: { color: "#ff8c00", fontSize: 13, letterSpacing: 1, marginBottom: 12 },
  toolbar: { display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" as const },
  btn: { background: "#ff8c00", color: "#000", border: "none", padding: "5px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: "bold", cursor: "pointer" },
  err: { color: "#ff3333", fontSize: 13 },
  muted: { color: "#777", fontSize: 13 },
  label: { color: "#ff8c00", fontSize: 13 },
};

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
    <div style={S.page}>
      <div style={S.header}>MARKET DATA / PRICE HISTORY</div>
      <div style={S.toolbar}>
        <span style={S.label}>SYMBOL</span>
        <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span style={S.label}>DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button style={S.btn} onClick={loadBars}>GO</button>
        {loading && <span style={S.muted}>LOADING...</span>}
        {bars.length > 0 && !loading && <span style={S.muted}>{bars.length} BARS</span>}
      </div>
      {error && <p style={S.err}>ERR: {error}</p>}
      {!loading && !error && bars.length > 0 && <CandlestickChart bars={bars} />}
    </div>
  );
}
