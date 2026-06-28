"use client";

import { useRef, useState } from "react";
import {
  ApiError,
  getOptionsGreeks, getOptionsChain,
  type OptionsGreeksResponse, type OptionsChainResponse, type OptionsChainRow,
} from "@/lib/api";

type Tab = "greeks" | "chain" | "surface";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt4(v: number): string { return v.toFixed(4); }
function fmt6(v: number): string { return v.toFixed(6); }

function signCls(v: number): string {
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">ERR: {msg}</p> : null;
}

// ── Greeks Tab ───────────────────────────────────────────────────────────────

function GreeksTab() {
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const [spot, setSpot] = useState("100");
  const [strike, setStrike] = useState("100");
  const [expiryDays, setExpiryDays] = useState("30");
  const [rate, setRate] = useState("0.05");
  const [vol, setVol] = useState("0.20");
  const [result, setResult] = useState<OptionsGreeksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getOptionsGreeks(
        optionType,
        parseFloat(spot), parseFloat(strike),
        parseInt(expiryDays), parseFloat(rate), parseFloat(vol),
        ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const GREEK_ROWS: { label: string; key: keyof OptionsGreeksResponse; fmt: (v: number) => string; desc: string }[] = [
    { label: "Price",           key: "price",           fmt: fmt4, desc: "Theoretical option price" },
    { label: "Intrinsic Value", key: "intrinsic_value", fmt: fmt4, desc: "max(S-K, 0) for call, max(K-S, 0) for put" },
    { label: "Time Value",      key: "time_value",      fmt: fmt4, desc: "Price minus intrinsic value" },
    { label: "Delta (Δ)",       key: "delta",           fmt: fmt4, desc: "Price change per $1 move in spot" },
    { label: "Gamma (Γ)",       key: "gamma",           fmt: fmt6, desc: "Delta change per $1 move in spot" },
    { label: "Theta (Θ)",       key: "theta",           fmt: fmt4, desc: "Price change per calendar day" },
    { label: "Vega (ν)",        key: "vega",            fmt: fmt4, desc: "Price change per 1% vol change" },
    { label: "Rho (ρ)",         key: "rho",             fmt: fmt4, desc: "Price change per 1% rate change" },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {/* Option type */}
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Type</label>
            <div className="flex gap-1">
              {(["call", "put"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setOptionType(t)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    optionType === t
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {[
            { label: "Spot (S)", value: spot, set: setSpot },
            { label: "Strike (K)", value: strike, set: setStrike },
            { label: "Expiry (days)", value: expiryDays, set: setExpiryDays },
            { label: "Rate (r)", value: rate, set: setRate },
            { label: "Vol (σ)", value: vol, set: setVol },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
              <input
                type="number"
                value={value}
                onChange={e => set(e.target.value)}
                step="any"
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"
              />
            </div>
          ))}
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Computing…" : "Compute"}
          </button>
        </div>
      </div>

      <Err msg={error} />

      {/* Results table */}
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">
            {optionType.toUpperCase()} Option Results
          </span>
        </div>
        <table className="border-collapse w-full">
          <tbody>
            {GREEK_ROWS.map(row => {
              const v = result ? (result[row.key] as number) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[180px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-32 ${loading ? "text-text-3/30" : v !== null ? signCls(v) : "text-text-3"}`}>
                    {loading ? "…" : v !== null ? row.fmt(v) : "—"}
                  </td>
                  <td className="px-4 py-2 text-text-3 text-xs">{row.desc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Chain Tab ─────────────────────────────────────────────────────────────────

function ChainTab() {
  const [spot, setSpot] = useState("100");
  const [expiryDays, setExpiryDays] = useState("30");
  const [rate, setRate] = useState("0.05");
  const [vol, setVol] = useState("0.20");
  const [result, setResult] = useState<OptionsChainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getOptionsChain(
        parseFloat(spot), parseInt(expiryDays), parseFloat(rate), parseFloat(vol),
        ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const spotNum = parseFloat(spot) || 100;

  function atmCls(row: OptionsChainRow): string {
    const moneyness = row.strike / spotNum;
    return moneyness > 0.98 && moneyness < 1.02 ? "bg-accent/5" : "";
  }

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {[
            { label: "Spot (S)", value: spot, set: setSpot },
            { label: "Expiry (days)", value: expiryDays, set: setExpiryDays },
            { label: "Rate (r)", value: rate, set: setRate },
            { label: "Vol (σ)", value: vol, set: setVol },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">{label}</label>
              <input
                type="number"
                value={value}
                onChange={e => set(e.target.value)}
                step="any"
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-24"
              />
            </div>
          ))}
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {loading ? "Computing…" : "Compute"}
          </button>
        </div>
      </div>

      <Err msg={error} />

      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border">
                <th colSpan={5} className="px-3 py-2 text-pos text-center border-r border-border">CALL</th>
                <th className="px-3 py-2 text-text-3 text-center font-medium">STRIKE</th>
                <th colSpan={5} className="px-3 py-2 text-neg text-center border-l border-border">PUT</th>
              </tr>
              <tr className="border-b border-border text-text-3">
                {["Price", "Δ", "Γ", "Θ", "ν"].map(h => (
                  <th key={`c-${h}`} className="px-3 py-1.5 text-right font-medium">{h}</th>
                ))}
                <th className="px-3 py-1.5 text-center font-semibold text-text-2 border-x border-border">K</th>
                {["Price", "Δ", "Γ", "Θ", "ν"].map(h => (
                  <th key={`p-${h}`} className="px-3 py-1.5 text-right font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map(row => (
                <tr key={row.strike} className={`border-b border-border hover:bg-panel-2 ${atmCls(row)}`}>
                  <td className="px-3 py-1.5 text-right text-pos">{fmt4(row.call_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.call_delta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmt6(row.call_gamma)}</td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.call_theta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.call_vega)}</td>
                  <td className="px-3 py-1.5 text-center font-semibold text-accent border-x border-border">
                    {row.strike}
                  </td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.put_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.put_delta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-3">{fmt6(row.put_gamma)}</td>
                  <td className="px-3 py-1.5 text-right text-neg">{fmt4(row.put_theta)}</td>
                  <td className="px-3 py-1.5 text-right text-text-2">{fmt4(row.put_vega)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure parameters and click Compute to view the options chain.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "greeks",  label: "Greeks" },
  { id: "chain",   label: "Chain" },
  { id: "surface", label: "IV Surface" },
];

export default function OptionsPage() {
  const [tab, setTab] = useState<Tab>("greeks");

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Options Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Black-Scholes pricing, Greeks, option chain, and implied volatility surface.
        </p>
      </div>

      {/* Tab bar */}
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

      {tab === "greeks"  && <GreeksTab />}
      {tab === "chain"   && <ChainTab />}
      {tab === "surface" && (
        <div className="text-center py-16 text-text-3 text-sm">
          IV Surface heatmap — implemented in Task 4.
        </div>
      )}
    </div>
  );
}
