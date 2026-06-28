"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, UTCTimestamp } from "lightweight-charts";
import {
  searchKR, searchUS, getKRBars, getIBBars,
  KRSearchResult, USSearchResult, KRBar, KISTick,
} from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const DURATIONS = [30, 90, 180, 365, 730] as const;
type Duration = (typeof DURATIONS)[number];

type Market = "KR" | "US";
type AnyResult = { label: string; sub: string; code: string };

function toAnyResult(r: KRSearchResult): AnyResult {
  return { label: r.name, sub: r.code + " · " + r.market, code: r.code };
}
function usAnyResult(r: USSearchResult): AnyResult {
  return { label: r.symbol, sub: (r.name || r.sec_type) + " · " + r.exchange, code: r.symbol };
}

function krDateToTs(date: string): UTCTimestamp {
  return Math.floor(
    new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`).getTime() / 1000,
  ) as UTCTimestamp;
}

type ChartBar = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

function CandleChart({ bars }: { bars: ChartBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      timeScale: { borderColor: "#374151" },
      rightPriceScale: { borderColor: "#374151" },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    series.setData(bars);
    chart.timeScale().fitContent();
    return () => { chart.remove(); };
  }, [bars]);

  return (
    <div ref={containerRef} style={{ height: "320px" }} className="w-full" />
  );
}

export default function SearchPage() {
  const [market, setMarket] = useState<Market>("KR");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnyResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [days, setDays] = useState<Duration>(365);
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState<KISTick | null>(null);
  const [wsStatus, setWsStatus] = useState<"off" | "connecting" | "live">("off");

  const searchAbortRef = useRef<AbortController | null>(null);
  const barsAbortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowResults(false); return; }
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      try {
        if (market === "KR") {
          const res = await searchKR(query, ctrl.signal);
          if (searchAbortRef.current !== ctrl) return;
          setResults(res.results.map(toAnyResult));
        } else {
          const res = await searchUS(query, ctrl.signal);
          if (searchAbortRef.current !== ctrl) return;
          setResults(res.results.map(usAnyResult));
        }
        setShowResults(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, market]);

  // Cleanup on unmount
  useEffect(() => () => {
    searchAbortRef.current?.abort();
    barsAbortRef.current?.abort();
    wsRef.current?.close();
  }, []);

  function connectWS(code: string) {
    wsRef.current?.close();
    setLiveTick(null);
    setWsStatus("connecting");
    const ws = new WebSocket(`${WS_BASE}/ws/live/${code}`);
    wsRef.current = ws;
    ws.onopen = () => { if (wsRef.current === ws) setWsStatus("live"); };
    ws.onclose = () => { if (wsRef.current === ws) setWsStatus("off"); };
    ws.onerror = () => { if (wsRef.current === ws) setWsStatus("off"); };
    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data) as KISTick;
        if (!tick.error) setLiveTick(tick);
      } catch { /* ignore */ }
    };
  }

  async function loadBars(code: string, name: string) {
    setSelected({ code, name });
    setShowResults(false);
    setError(null);
    setBars([]);

    barsAbortRef.current?.abort();
    const ctrl = new AbortController();
    barsAbortRef.current = ctrl;
    setLoadingBars(true);

    try {
      if (market === "KR") {
        const res = await getKRBars(code, days, ctrl.signal);
        if (barsAbortRef.current !== ctrl) return;
        setBars(res.bars.map((b: KRBar) => ({
          time: krDateToTs(b.date),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })));
        connectWS(code);
      } else {
        const ibDuration = days > 365 ? `${Math.round(days / 365)} Y` : `${days} D`;
        const res = await getIBBars(
          { symbol: code, asset_type: "stock", duration: ibDuration },
          ctrl.signal,
        );
        if (barsAbortRef.current !== ctrl) return;
        setBars(res.bars.map(b => ({
          time: Math.floor(b.ts_ms / 1000) as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (barsAbortRef.current === ctrl) setError(e instanceof Error ? e.message : "Failed to load bars");
    } finally {
      if (barsAbortRef.current === ctrl) setLoadingBars(false);
    }
  }

  const changeCls = liveTick
    ? liveTick.change > 0 ? "text-pos" : liveTick.change < 0 ? "text-neg" : "text-text-3"
    : "text-text-3";

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Search</h1>
        <p className="text-text-3 text-sm mt-0.5">Search any KR/US listed instrument and load OHLCV chart.</p>
      </div>

      {/* Market toggle + search bar */}
      <div className="flex gap-2">
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(["KR", "US"] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => { setMarket(m); setQuery(""); setResults([]); setSelected(null); setBars([]); setLiveTick(null); wsRef.current?.close(); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${market === m ? "bg-accent/10 text-accent border-accent" : "text-text-2 hover:text-text-1"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            placeholder={market === "KR" ? "종목명 또는 코드 (예: 삼성전자, 005930)" : "Symbol or name (e.g. AAPL, Apple)"}
            className="w-full px-3 py-2 text-sm rounded-lg bg-panel border border-border text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
          />
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-panel border border-border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
              {results.map(r => (
                <button
                  key={r.code}
                  onMouseDown={() => loadBars(r.code, r.label)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-panel-2 text-left"
                >
                  <span className="text-text-1 font-medium">{r.label}</span>
                  <span className="text-text-3 text-xs">{r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value) as Duration)}
          className="px-3 py-2 text-sm rounded-lg bg-panel border border-border text-text-1 focus:outline-none focus:border-accent"
        >
          {DURATIONS.map(d => (
            <option key={d} value={d}>{d}D</option>
          ))}
        </select>
      </div>

      {/* Selected header + live ticker */}
      {selected && (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-text-1 font-semibold">{selected.name}</span>
            <span className="text-text-3 text-sm ml-2">{selected.code}</span>
          </div>
          <div className="flex items-center gap-3">
            {liveTick && (
              <>
                <span className="text-text-1 font-data text-lg">{liveTick.price.toLocaleString()}</span>
                <span className={`text-sm font-data ${changeCls}`}>
                  {liveTick.change > 0 ? "+" : ""}{liveTick.change.toLocaleString()} ({liveTick.change_rate.toFixed(2)}%)
                </span>
                <span className="text-text-3 text-xs">Vol {liveTick.trade_volume.toLocaleString()}</span>
              </>
            )}
            {market === "KR" && (
              <span className={`text-xs px-2 py-0.5 rounded border ${wsStatus === "live" ? "border-pos/40 text-pos bg-pos/5" : wsStatus === "connecting" ? "border-warn/40 text-warn bg-warn/5" : "border-border text-text-3"}`}>
                {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "CONNECTING" : "OFFLINE"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        {loadingBars && (
          <div className="flex items-center justify-center h-[320px] text-text-3 text-sm">Loading chart...</div>
        )}
        {error && !loadingBars && (
          <div className="flex items-center justify-center h-[320px] text-neg text-sm">{error}</div>
        )}
        {!loadingBars && !error && bars.length > 0 && (
          <CandleChart bars={bars} />
        )}
        {!loadingBars && !error && bars.length === 0 && !selected && (
          <div className="flex items-center justify-center h-[320px] text-text-3 text-sm">
            Search a stock above to load the chart
          </div>
        )}
      </div>
    </div>
  );
}
