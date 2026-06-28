"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import { ApiError, getIBBars, type IBBarsResponse } from "@/lib/api";

type AssetTab = "stock" | "forex" | "future" | "option" | "crypto";

const TABS: { id: AssetTab; label: string }[] = [
  { id: "stock",  label: "Stock"  },
  { id: "forex",  label: "Forex"  },
  { id: "future", label: "Future" },
  { id: "option", label: "Option" },
  { id: "crypto", label: "Crypto" },
];

const DURATIONS = ["1 W", "1 M", "3 M", "6 M", "1 Y", "2 Y", "5 Y"] as const;

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mb-3">ERR: {msg}</p> : null;
}

function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6);
}

// ── Shared chart component ────────────────────────────────────────────────────

function CandleChart({ result }: { result: IBBarsResponse }) {
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current || !result.bars.length) return;
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
      result.bars.map(b => ({
        time: Math.floor(b.ts_ms / 1000) as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );
    chart.timeScale().fitContent();
    return () => { chart.remove(); };
  }, [result]);

  const last = result.bars.at(-1);

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-4">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">
          {result.symbol} · {result.count} bars
        </span>
        {last && (
          <span className="text-text-2 text-xs font-data">
            Last: <span className="text-text-1 font-semibold">{fmtPrice(last.close)}</span>
          </span>
        )}
      </div>
      <div className="p-3">
        <div ref={chartRef} style={{ height: "320px" }} />
      </div>
    </div>
  );
}

// ── Tab forms ─────────────────────────────────────────────────────────────────

interface FormShellProps {
  children: React.ReactNode;
  onLoad: () => void;
  loading: boolean;
}

function FormShell({ children, onLoad, loading }: FormShellProps) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {children}
        <button
          onClick={onLoad}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-text-3 text-[11px] uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data";

function DurationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Duration">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} cursor-pointer`}
      >
        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </Field>
  );
}

function EndDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="End Date (optional)">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="20250101"
        className={`${inputCls} w-28`}
      />
    </Field>
  );
}

// ── Per-tab load hooks ─────────────────────────────────────────────────────────

function useIBBars() {
  const [result, setResult]   = useState<IBBarsResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef              = useRef<AbortController | null>(null);

  async function load(params: Parameters<typeof getIBBars>[0]) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getIBBars(params, ctrl.signal));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { result, error, loading, load };
}

// ── Tab implementations ───────────────────────────────────────────────────────

function StockTab() {
  const [symbol, setSymbol]   = useState("AAPL");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell onLoad={() => { if (!symbol.trim()) { return; } load({ symbol, asset_type: "stock", end_date: endDate, duration }); }} loading={loading}>
        <Field label="Symbol">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-20 uppercase`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function ForexTab() {
  const [pair, setPair]       = useState("EURUSD");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell onLoad={() => { if (!pair.trim()) { return; } load({ symbol: pair, asset_type: "forex", end_date: endDate, duration }); }} loading={loading}>
        <Field label="Pair (e.g. EURUSD)">
          <input type="text" value={pair} onChange={e => setPair(e.target.value.toUpperCase())} className={`${inputCls} w-24 uppercase`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function FutureTab() {
  const [symbol, setSymbol]   = useState("ES");
  const [exchange, setExchange] = useState("CME");
  const [expiry, setExpiry]   = useState("202509");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => { if (!symbol.trim() || !exchange.trim() || !expiry.trim()) { return; } load({ symbol, asset_type: "future", exchange, expiry, end_date: endDate, duration }); }}
        loading={loading}
      >
        <Field label="Symbol">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="Exchange">
          <input type="text" value={exchange} onChange={e => setExchange(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="Expiry (YYYYMM)">
          <input type="text" value={expiry} onChange={e => setExpiry(e.target.value)} className={`${inputCls} w-24`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function OptionTab() {
  const [symbol, setSymbol]   = useState("SPY");
  const [expiry, setExpiry]   = useState("20271219");
  const [strike, setStrike]   = useState("500");
  const [right, setRight]     = useState<"C" | "P">("C");
  const [duration, setDuration] = useState("3 M");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => {
          if (!symbol.trim() || !expiry.trim()) { return; }
          load({
            symbol,
            asset_type: "option",
            expiry,
            strike: parseFloat(strike),
            right,
            end_date: endDate,
            duration,
          });
        }}
        loading={loading}
      >
        <Field label="Symbol">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <Field label="Expiry (YYYYMMDD)">
          <input type="text" value={expiry} onChange={e => setExpiry(e.target.value)} className={`${inputCls} w-24`} />
        </Field>
        <Field label="Strike">
          <input type="number" value={strike} onChange={e => setStrike(e.target.value)} className={`${inputCls} w-20`} />
        </Field>
        <Field label="Right">
          <select
            value={right}
            onChange={e => setRight(e.target.value as "C" | "P")}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="C">Call</option>
            <option value="P">Put</option>
          </select>
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

function CryptoTab() {
  const [symbol, setSymbol]   = useState("BTC");
  const [duration, setDuration] = useState("1 Y");
  const [endDate, setEndDate] = useState("");
  const { result, error, loading, load } = useIBBars();

  return (
    <div className="space-y-4">
      <FormShell
        onLoad={() => { if (!symbol.trim()) { return; } load({ symbol, asset_type: "crypto", end_date: endDate, duration }); }}
        loading={loading}
      >
        <Field label="Symbol (BTC/ETH/SOL…)">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className={`${inputCls} w-16 uppercase`} />
        </Field>
        <DurationSelect value={duration} onChange={setDuration} />
        <EndDateInput value={endDate} onChange={setEndDate} />
      </FormShell>
      <p className="text-text-3 text-[11px]">
        Supported via PAXOS: BTC · ETH · LTC · BCH · XRP · SOL
      </p>
      <Err msg={error} />
      {result && <CandleChart result={result} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IBPage() {
  const [tab, setTab] = useState<AssetTab>("stock");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">IB Market Data</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Historical OHLCV bars from Interactive Brokers — requires TWS or IB Gateway running locally.
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

      {tab === "stock"  && <StockTab />}
      {tab === "forex"  && <ForexTab />}
      {tab === "future" && <FutureTab />}
      {tab === "option" && <OptionTab />}
      {tab === "crypto" && <CryptoTab />}
    </div>
  );
}
