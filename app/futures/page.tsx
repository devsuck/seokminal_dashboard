"use client";

import { useRef, useState } from "react";
import {
  ApiError,
  getFuturesPrice, getFuturesRoll,
  type FuturesPriceResponse, type FuturesRollResponse, type FuturesRollRow,
} from "@/lib/api";

type Tab = "pricer" | "curve" | "roll";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt4(v: number): string { return v.toFixed(4); }
function fmt2(v: number): string { return v.toFixed(2); }

function structureCls(s: string): string {
  if (s === "contango") return "text-warn";
  if (s === "backwardation") return "text-info";
  return "text-text-3";
}

function rollCostCls(v: number): string {
  return v > 0 ? "text-neg" : v < 0 ? "text-pos" : "text-text-3";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-sm mt-0 mb-3">ERR: {msg}</p> : null;
}

// ── Shared input row ──────────────────────────────────────────────────────────

function InputRow({
  fields,
  onCompute,
  loading,
}: {
  fields: { label: string; value: string; set: (v: string) => void }[];
  onCompute: () => void;
  loading: boolean;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-4">
      <div className="flex gap-3 flex-wrap items-end">
        {fields.map(({ label, value, set }) => (
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
          onClick={onCompute}
          disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed self-end"
        >
          {loading ? "Computing…" : "Compute"}
        </button>
      </div>
    </div>
  );
}

// ── Pricer Tab ────────────────────────────────────────────────────────────────

const PRICER_ROWS: { label: string; key: keyof FuturesPriceResponse; fmt: (v: number) => string; desc: string }[] = [
  { label: "Futures Price",      key: "price",            fmt: fmt4, desc: "F = S · e^((r-q)·T)" },
  { label: "Basis",              key: "basis",            fmt: fmt4, desc: "F − S" },
  { label: "Basis %",            key: "basis_pct",        fmt: fmt2, desc: "(F − S) / S × 100" },
  { label: "Annualized Carry %", key: "annualized_carry", fmt: fmt2, desc: "(r − q) × 100" },
];

function PricerTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [expiryDays, setExpiryDays] = useState("30");
  const [result, setResult] = useState<FuturesPriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesPrice(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield),
        parseInt(expiryDays, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)", value: spot, set: setSpot },
          { label: "Rate (r)", value: rate, set: setRate },
          { label: "Conv. Yield (q)", value: convYield, set: setConvYield },
          { label: "Expiry (days)", value: expiryDays, set: setExpiryDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
          <span className="text-text-3 text-[11px] uppercase tracking-wider">Futures Pricer</span>
          {result && (
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${structureCls(result.market_structure)}`}>
              {result.market_structure}
            </span>
          )}
        </div>
        <table className="border-collapse w-full">
          <tbody>
            {PRICER_ROWS.map(row => {
              const v = result ? (result[row.key] as number) : null;
              return (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-accent text-[13px] w-[220px]">{row.label}</td>
                  <td className={`px-4 py-2 text-sm font-data font-bold w-32 ${loading ? "text-text-3/30" : v !== null ? (v >= 0 ? "text-pos" : "text-neg") : "text-text-3"}`}>
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

// ── Roll Tab ──────────────────────────────────────────────────────────────────

function RollTab() {
  const [spot, setSpot] = useState("100");
  const [rate, setRate] = useState("0.05");
  const [convYield, setConvYield] = useState("0.02");
  const [frontDays, setFrontDays] = useState("30");
  const [result, setResult] = useState<FuturesRollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      setResult(await getFuturesRoll(
        parseFloat(spot), parseFloat(rate), parseFloat(convYield),
        parseInt(frontDays, 10), ctrl.signal
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <InputRow
        fields={[
          { label: "Spot (S)", value: spot, set: setSpot },
          { label: "Rate (r)", value: rate, set: setRate },
          { label: "Conv. Yield (q)", value: convYield, set: setConvYield },
          { label: "Front (days)", value: frontDays, set: setFrontDays },
        ]}
        onCompute={run}
        loading={loading}
      />
      <Err msg={error} />
      {result && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-xs font-data">
            <thead>
              <tr className="border-b border-border text-text-3">
                <th className="px-3 py-2 text-left font-medium">Roll</th>
                <th className="px-3 py-2 text-right font-medium">Front F</th>
                <th className="px-3 py-2 text-right font-medium">Back F</th>
                <th className="px-3 py-2 text-right font-medium">Roll Cost</th>
                <th className="px-3 py-2 text-right font-medium">Cost %</th>
                <th className="px-3 py-2 text-right font-medium">Ann. Yield %</th>
                <th className="px-3 py-2 text-right font-medium">Days to Roll</th>
              </tr>
            </thead>
            <tbody>
              {result.rolls.map((row: FuturesRollRow) => (
                <tr key={row.back_days} className="border-b border-border hover:bg-panel-2">
                  <td className="px-3 py-1.5 text-text-2">
                    {result.front_days}d → {row.back_days}d
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmt4(row.front_price)}</td>
                  <td className="px-3 py-1.5 text-right text-text-1">{fmt4(row.back_price)}</td>
                  <td className={`px-3 py-1.5 text-right font-bold ${rollCostCls(row.roll_cost)}`}>
                    {row.roll_cost > 0 ? "+" : ""}{fmt4(row.roll_cost)}
                  </td>
                  <td className={`px-3 py-1.5 text-right ${rollCostCls(row.roll_cost_pct)}`}>
                    {row.roll_cost_pct > 0 ? "+" : ""}{fmt2(row.roll_cost_pct)}%
                  </td>
                  <td className={`px-3 py-1.5 text-right ${rollCostCls(-row.annualized_roll_yield)}`}>
                    {row.annualized_roll_yield > 0 ? "+" : ""}{fmt2(row.annualized_roll_yield)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-text-3">{row.days_to_roll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure parameters and click Compute to view rollover costs.
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "pricer", label: "Pricer" },
  { id: "curve",  label: "Curve" },
  { id: "roll",   label: "Roll" },
];

export default function FuturesPage() {
  const [tab, setTab] = useState<Tab>("pricer");

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Futures Analytics</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Cost-of-carry pricing, term structure curve, and rollover cost analysis.
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

      {tab === "pricer" && <PricerTab />}
      {tab === "roll"   && <RollTab />}
      {tab === "curve"  && (
        <div className="text-center py-16 text-text-3 text-sm">
          Term structure curve — implemented in Task 4.
        </div>
      )}
    </div>
  );
}
