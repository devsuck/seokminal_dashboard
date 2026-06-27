"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getBars, ApiError } from "@/lib/api";
import {
  computeFactor,
  type FactorResult,
  type FactorType,
  type InstrumentBars,
} from "@/lib/factor-utils";

type LookbackOption = 20 | 60 | 126 | 252;
type HorizonOption = 0 | 5 | 20 | 60;

const LOOKBACK_OPTIONS: LookbackOption[] = [20, 60, 126, 252];
const HORIZON_OPTIONS: HorizonOption[] = [0, 5, 20, 60];
const DEFAULT_INSTRUMENTS = "005930.XKRX, 000660.XKRX, 035420.XKRX, 051910.XKRX, 005380.XKRX";
const DEFAULT_START = "2022-01-01";
const DEFAULT_END = "2026-01-01";

async function fetchAllBars(
  instrumentIds: string[],
  start: string,
  end: string,
  signal: AbortSignal,
  concurrency = 5,
): Promise<InstrumentBars[]> {
  const results: InstrumentBars[] = [];
  for (let i = 0; i < instrumentIds.length; i += concurrency) {
    const batch = instrumentIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async id => {
        const res = await getBars(id, start, end, undefined, signal);
        return { instrumentId: id, bars: res.bars } satisfies InstrumentBars;
      }),
    );
    results.push(...batchResults);
  }
  return results;
}

export default function FactorPage() {
  const [instrumentsText, setInstrumentsText] = useState(DEFAULT_INSTRUMENTS);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [factorType, setFactorType] = useState<FactorType>("momentum");
  const [lookback, setLookback] = useState<LookbackOption>(60);
  const [horizon, setHorizon] = useState<HorizonOption>(20);
  const [result, setResult] = useState<FactorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const run = useCallback(async () => {
    const ids = instrumentsText
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length < 2) {
      setError("Enter at least 2 instrument IDs");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const instruments = await fetchAllBars(ids, start, end, ctrl.signal);
      const r = computeFactor(instruments, factorType, lookback, horizon);
      setResult(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to compute factor");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentsText, start, end, factorType, lookback, horizon]);

  const maxAbsValue = useMemo(() => {
    if (!result) return 1;
    const vals = result.values.map(v => Math.abs(v.value ?? 0));
    return Math.max(...vals, 0.001);
  }, [result]);

  const showFutureReturn = horizon > 0;

  return (
    <div className="p-6 space-y-4 max-w-[1000px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Factor Lab</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Cross-sectional factor analysis. Rank instruments by momentum or volatility and compute IC.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-text-3 text-[11px] uppercase tracking-wider">Instruments (comma or newline separated)</label>
          <textarea
            rows={2}
            value={instrumentsText}
            onChange={e => setInstrumentsText(e.target.value)}
            placeholder="AAPL.NASDAQ, MSFT.NASDAQ, ..."
            className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none font-data"
          />
        </div>

        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data" />
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Factor</label>
            <div className="flex gap-1">
              {(["momentum", "volatility"] as FactorType[]).map(f => (
                <button key={f} onClick={() => setFactorType(f)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer capitalize transition-colors ${
                    factorType === f ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Lookback</label>
            <div className="flex gap-1">
              {LOOKBACK_OPTIONS.map(l => (
                <button key={l} onClick={() => setLookback(l)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    lookback === l ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}>
                  {l}d
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">IC Horizon</label>
            <div className="flex gap-1">
              {HORIZON_OPTIONS.map(h => (
                <button key={h} onClick={() => setHorizon(h)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    horizon === h ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}>
                  {h === 0 ? "None" : `${h}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={run} disabled={loading}
          className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? "Computing…" : "Run"}
        </button>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{error}</div>
      )}

      {result && (
        <>
          {/* IC badge */}
          {showFutureReturn && (
            <div className="flex gap-4 text-xs flex-wrap">
              <span className="text-text-3">
                IC ({horizon}d horizon):{" "}
                <span className={`font-data font-semibold ${result.ic !== null && result.ic > 0 ? "text-pos" : result.ic !== null && result.ic < 0 ? "text-neg" : "text-text-2"}`}>
                  {result.ic !== null ? result.ic.toFixed(4) : "—"}
                </span>
              </span>
              <span className="text-text-3">
                N instruments: <span className="text-text-2 font-data">{result.values.length}</span>
              </span>
            </div>
          )}

          {/* Factor bar chart */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">
                {factorType === "momentum" ? "Momentum" : "Volatility"} &mdash; {lookback}d lookback
              </span>
              {showFutureReturn && (
                <span className="text-text-3 text-[11px] ml-4">
                  | Future Return ({horizon}d)
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-0.5">
              {/* Header */}
              <div className="flex items-center gap-2 pb-1 border-b border-border/40 mb-1">
                <span className="text-text-3 text-[10px] uppercase w-32 shrink-0">Instrument</span>
                <span className="flex-1 text-text-3 text-[10px] uppercase">Factor Value</span>
                <span className="text-text-3 text-[10px] uppercase w-20 text-right">Value</span>
                {showFutureReturn && (
                  <span className="text-text-3 text-[10px] uppercase w-16 text-right">Future Ret</span>
                )}
              </div>
              {result.values.map(v => {
                const pct = maxAbsValue > 0 && v.value !== null
                  ? (Math.abs(v.value) / maxAbsValue) * 100
                  : 0;
                const isPos = v.value !== null && v.value >= 0;
                return (
                  <div key={v.instrumentId} className="flex items-center gap-2 py-0.5">
                    <span className="text-text-3 font-data text-xs w-32 shrink-0 truncate">
                      {v.instrumentId.split(".")[0]}
                    </span>
                    <div className="flex-1">
                      <div
                        className={`h-4 rounded-sm ${isPos ? "bg-pos/50" : "bg-neg/50"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-data w-20 text-right ${isPos ? "text-pos" : v.value === null ? "text-text-3" : "text-neg"}`}>
                      {v.value !== null ? `${(v.value * 100).toFixed(2)}%` : "—"}
                    </span>
                    {showFutureReturn && (
                      <span className={`text-xs font-data w-16 text-right ${v.futureReturn === null ? "text-text-3" : v.futureReturn >= 0 ? "text-pos" : "text-neg"}`}>
                        {v.futureReturn !== null ? `${(v.futureReturn * 100).toFixed(2)}%` : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Enter instruments and click Run to compute cross-sectional factors.
        </div>
      )}
    </div>
  );
}
