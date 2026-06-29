"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, getAiRecommendation, type AiRecommendation } from "@/lib/api";
import { PageBanner } from "@/components/PageBanner";

function buildBacktestUrl(strategy: string, params: Record<string, unknown>): string {
  const q = new URLSearchParams({ strategy });
  for (const [k, v] of Object.entries(params)) {
    q.set(k, String(v));
  }
  return `/backtest?${q.toString()}`;
}

const STRATEGY_LABELS: Record<string, string> = {
  ema_cross: "EMA Cross",
  macd: "MACD",
  rsi: "RSI",
};

const STRATEGY_PARAMS_LABELS: Record<string, Record<string, string>> = {
  ema_cross: { fast: "Fast Period", slow: "Slow Period" },
  macd: { fast: "Fast Period", slow: "Slow Period", signal_period: "Signal Period" },
  rsi: { period: "Period", oversold: "Oversold", overbought: "Overbought" },
};

export default function AITraderPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart]               = useState("2025-01-01");
  const [end, setEnd]                   = useState("2026-06-01");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<AiRecommendation | null>(null);

  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { ctrlRef.current?.abort(); };
  }, []);

  async function analyze() {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const rec = await getAiRecommendation(instrumentId, start, end, ctrl.signal);
      if (!ctrl.signal.aborted) setResult(rec);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted) {
        setError(err instanceof ApiError ? err.message : "Recommendation failed");
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const paramLabels = result ? (STRATEGY_PARAMS_LABELS[result.strategy] ?? {}) : {};

  return (
    <div className="p-6 space-y-5 max-w-[760px]">
      <PageBanner pageKey="ai-trader" />

      {/* Input form */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-text-3 text-xs">Instrument ID</label>
            <input
              value={instrumentId}
              onChange={e => setInstrumentId(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
              placeholder="AAPL.NASDAQ"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-3 text-xs">Start</label>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-text-3 text-xs">End</label>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
            />
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={loading}
          className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Get AI Recommendation"}
        </button>
      </div>

      {error && (
        <p className="text-neg text-sm">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded border border-accent/40 text-accent bg-accent/10 font-medium tracking-wide uppercase">
              {STRATEGY_LABELS[result.strategy] ?? result.strategy}
            </span>
            <span className="text-text-3 text-xs">{result.instrument_id}</span>
          </div>

          {/* Params */}
          <div>
            <p className="text-text-3 text-xs uppercase tracking-wider mb-2">Recommended Parameters</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(result.params).map(([key, val]) => (
                <div key={key}>
                  <p className="text-text-3 text-xs">{paramLabels[key] ?? key}</p>
                  <p className="text-text-1 text-sm font-medium">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <p className="text-text-3 text-xs uppercase tracking-wider mb-1">Analysis</p>
            <p className="text-text-2 text-sm leading-relaxed">{result.reasoning}</p>
          </div>

          {/* Link to backtest */}
          <a
            href={buildBacktestUrl(result.strategy, result.params)}
            className="inline-flex text-accent text-xs border border-accent/30 rounded px-3 py-1.5 hover:bg-accent/10 transition-colors"
          >
            Open Backtest →
          </a>
        </div>
      )}
    </div>
  );
}
