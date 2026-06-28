"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import {
  ApiError,
  getCryptoAssets, getCryptoCandles,
  type CryptoAssetsResponse, type CryptoCandlesResponse,
} from "@/lib/api";

type Tab = "markets" | "chart" | "book";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(v: number): string { return v.toFixed(2); }
function fmt4(v: number): string { return v.toFixed(4); }

function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6);
}

function fmtVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function changeCls(v: number): string {
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
}

function fundingCls(v: number): string {
  return v > 0 ? "text-warn" : v < 0 ? "text-info" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mb-3">ERR: {msg}</p> : null;
}

// ── Markets Tab ───────────────────────────────────────────────────────────────

function MarketsTab() {
  const [result, setResult]   = useState<CryptoAssetsResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getCryptoAssets(ctrl.signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to fetch markets");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-text-3 text-xs uppercase tracking-wider">
          {result ? `${result.count} markets · Hyperliquid Perps` : "Hyperliquid Perps"}
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="h-7 px-4 bg-panel border border-border text-text-2 text-xs rounded cursor-pointer hover:text-text-1 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <Err msg={error} />
      {loading && !result && (
        <div className="text-center py-16 text-text-3 text-sm">Loading markets…</div>
      )}
      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border text-text-3">
                <th className="px-3 py-2 text-left font-medium">Coin</th>
                <th className="px-3 py-2 text-right font-medium">Mid Price</th>
                <th className="px-3 py-2 text-right font-medium">24h Change</th>
                <th className="px-3 py-2 text-right font-medium">Funding 8h %</th>
                <th className="px-3 py-2 text-right font-medium">Funding Ann %</th>
                <th className="px-3 py-2 text-right font-medium">OI</th>
                <th className="px-3 py-2 text-right font-medium">24h Vol</th>
              </tr>
            </thead>
            <tbody>
              {result.assets.map(asset => (
                <tr key={asset.name} className="border-b border-border hover:bg-panel-2">
                  <td className="px-3 py-1.5 text-accent font-semibold">{asset.name}</td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmtPrice(asset.mid_price)}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${changeCls(asset.day_change_pct)}`}>
                    {asset.day_change_pct >= 0 ? "+" : ""}{fmt2(asset.day_change_pct)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${fundingCls(asset.funding_rate_8h)}`}>
                    {asset.funding_rate_8h >= 0 ? "+" : ""}{fmt4(asset.funding_rate_8h)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${fundingCls(asset.funding_rate)}`}>
                    {asset.funding_rate >= 0 ? "+" : ""}{fmt2(asset.funding_rate)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt2(asset.open_interest)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmtVolume(asset.day_volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Chart Tab ─────────────────────────────────────────────────────────────────

const INTERVALS = ["1d", "4h", "1h", "15m"] as const;

function ChartTab() {
  const [coin, setCoin]       = useState("BTC");
  const [interval, setInterval] = useState<typeof INTERVALS[number]>("1d");
  const [days, setDays]       = useState("90");
  const [result, setResult]   = useState<CryptoCandlesResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);
  const chartRef              = useRef<HTMLDivElement | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getCryptoCandles(
        coin.toUpperCase(), interval, parseInt(days, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!result || !chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9AA4B2",
      },
      grid: {
        vertLines: { color: "#2a3040" },
        horzLines: { color: "#2a3040" },
      },
      width: chartRef.current.clientWidth,
      height: 320,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#44cc88",
      downColor: "#ff4444",
      borderVisible: false,
      wickUpColor: "#44cc88",
      wickDownColor: "#ff4444",
    });

    series.setData(
      result.candles.map(c => ({
        time: Math.floor(c.time_ms / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    chart.timeScale().fitContent();

    return () => { chart.remove(); };
  }, [result]);

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Coin</label>
            <input
              type="text"
              value={coin}
              onChange={e => setCoin(e.target.value.toUpperCase())}
              placeholder="BTC"
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-20 uppercase"
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Interval</label>
            <select
              value={interval}
              onChange={e => setInterval(e.target.value as typeof INTERVALS[number])}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent cursor-pointer"
            >
              {INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Days</label>
            <input
              type="number"
              value={days}
              onChange={e => setDays(e.target.value)}
              min={1}
              max={365}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-20"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
      </div>
      <Err msg={error} />
      {result && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
            <span className="text-text-3 text-[11px] uppercase tracking-wider">
              {result.coin} · {result.interval} · {result.candles.length} candles
            </span>
          </div>
          <div className="p-3">
            <div ref={chartRef} style={{ height: "320px" }} />
          </div>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Enter a coin and click Load to view the chart.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "markets", label: "Markets" },
  { id: "chart",   label: "Chart" },
  { id: "book",    label: "Book" },
];

export default function CryptoPage() {
  const [tab, setTab] = useState<Tab>("markets");

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Crypto Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Live perpetual futures data from Hyperliquid — no authentication required.
        </p>
      </div>

      <div className="flex border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-1.5 text-sm cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
              tab === t.id
                ? "border-accent text-accent font-bold"
                : "border-transparent text-text-3 font-normal hover:text-text-1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "markets" && <MarketsTab />}
      {tab === "chart"   && <ChartTab />}
      {tab === "book"    && (
        <div className="text-center py-16 text-text-3 text-sm">
          Order book depth — implemented in Task 4.
        </div>
      )}
    </div>
  );
}
