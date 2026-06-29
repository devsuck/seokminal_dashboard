"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateWorkflow } from "@/lib/workflow-storage";
import { ApiError, getBars, getBacktest, runBacktestOptimize, type BarOut, type BacktestResponse, type OptimizeResponse } from "@/lib/api";
import { logActivity } from "@/lib/dashboard-storage";
import { saveBacktestResult } from "@/lib/backtest-result-storage";
import {
  buildSpawnRules,
  newRule,
  type Mode,
  type SpawnRuleState,
} from "@/lib/backtest-types";
import { ScenarioSelect } from "@/components/backtest/ScenarioSelect";
import {
  saveExperiment, extractMetrics, makeExperimentLabel,
  type ExperimentStrategy,
} from "@/lib/experiment-storage";
import {
  StrategyModeTabs,
  StrategyControlPanel,
  SingleStrategyForm,
  CompositeStrategyBuilder,
  ChartPanel,
  MetricGrid,
  TradeLogTable,
} from "@/components/ui";
import { SaveStrategyForm } from "@/components/strategies/SaveStrategyForm";
import type { StrategyParams } from "@/lib/strategy-storage";

export default function BacktestPage() {
  const [mode, setMode]               = useState<Mode>("single");
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart]             = useState("2025-06-25");
  const [end, setEnd]                 = useState("2026-06-23");
  const [timeframe, setTimeframe]     = useState("1D");
  const [fast, setFast]               = useState(10);
  const [slow, setSlow]               = useState(20);
  const [benchmarkId, setBenchmarkId] = useState("");
  const [rules, setRules]             = useState<SpawnRuleState[]>([newRule()]);
  const [bars, setBars]               = useState<BarOut[]>([]);
  const [result, setResult]           = useState<BacktestResponse | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [saveLabel, setSaveLabel]           = useState("");
  const [showSaveResult, setShowSaveResult] = useState(false);
  const [resultSaved, setResultSaved]       = useState(false);
  const [showSaveStrategy, setShowSaveStrategy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Strategy type selector
  const [strategyType, setStrategyType] = useState<"ema_cross" | "macd" | "rsi">("ema_cross");

  // MACD params
  const [macdFast, setMacdFast]     = useState(12);
  const [macdSlow, setMacdSlow]     = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  // RSI params
  const [rsiPeriod, setRsiPeriod]         = useState(14);
  const [rsiOversold, setRsiOversold]     = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);

  // Optimize state
  const [optimizing, setOptimizing]           = useState(false);
  const [optimizeResult, setOptimizeResult]   = useState<OptimizeResponse | null>(null);
  const optimizeCtrlRef = useRef<AbortController | null>(null);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (optimizeCtrlRef.current) optimizeCtrlRef.current.abort();
    };
  }, []);

  // ── Business logic ───────────────────────────────────────────────
  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      let strategy: string;
      let strategyParams: Record<string, string>;
      if (mode === "single") {
        if (strategyType === "macd") {
          strategy = "macd";
          strategyParams = { fast: String(macdFast), slow: String(macdSlow), signal_period: String(macdSignal) };
        } else if (strategyType === "rsi") {
          strategy = "rsi";
          strategyParams = { period: String(rsiPeriod), oversold: String(rsiOversold), overbought: String(rsiOverbought) };
        } else {
          strategy = "ema_cross";
          strategyParams = { fast: String(fast), slow: String(slow) };
        }
      } else {
        if (rules.length === 0) { setError("최소 1개 이상의 Rule 필요"); setLoading(false); return; }
        strategy = "gated";
        strategyParams = { spawn_rules: JSON.stringify(buildSpawnRules(rules, instrumentId)) };
      }
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, timeframe, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, strategyParams, benchmarkId || undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setResult(btRes);
      const singleLabel =
        strategyType === "macd"
          ? `${instrumentId} MACD ${macdFast}/${macdSlow}/${macdSignal} ${start}→${end}`
          : strategyType === "rsi"
          ? `${instrumentId} RSI(${rsiPeriod}) ${start}→${end}`
          : `${instrumentId} EMA ${fast}/${slow} ${start}→${end}`;
      setSaveLabel(
        mode === "single"
          ? singleLabel
          : `${instrumentId} Gated(${rules.length}R) ${start}→${end}`
      );
      setShowSaveResult(false);
      setResultSaved(false);
      const activityLabel =
        mode === "single"
          ? (strategyType === "macd"
              ? `${instrumentId} MACD ${macdFast}/${macdSlow}/${macdSignal}`
              : strategyType === "rsi"
              ? `${instrumentId} RSI(${rsiPeriod})`
              : `${instrumentId} EMA ${fast}/${slow}`)
          : `${instrumentId} Gated (${rules.length} rule${rules.length !== 1 ? "s" : ""})`;
      logActivity({
        type: "backtest",
        label: activityLabel,
        href: "/backtest",
      });
      saveExperiment({
        label: makeExperimentLabel(
          mode === "single"
            ? { strategy: "ema_cross" as ExperimentStrategy, instrumentId, fast, slow }
            : { strategy: "gated" as ExperimentStrategy, instrumentId, rulesCount: rules.length }
        ),
        params: {
          strategy: (mode === "single" ? strategyType : "gated") as ExperimentStrategy,
          instrumentId,
          start,
          end,
          timeframe,
          benchmarkId,
          ...(mode === "single" ? { fast, slow } : { rulesCount: rules.length }),
        },
        metrics: extractMetrics(btRes),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setBars([]); setResult(null);
    } finally { setLoading(false); }
  }

  async function optimize() {
    if (optimizeCtrlRef.current) optimizeCtrlRef.current.abort();
    const ctrl = new AbortController();
    optimizeCtrlRef.current = ctrl;
    setOptimizing(true);
    setOptimizeResult(null);
    try {
      const res = await runBacktestOptimize(instrumentId, start, end, strategyType as "macd" | "rsi", ctrl.signal);
      if (!ctrl.signal.aborted) setOptimizeResult(res);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
    } finally {
      if (!ctrl.signal.aborted) setOptimizing(false);
    }
  }

  function applyBestParams() {
    if (!optimizeResult) return;
    const p = optimizeResult.best_params;
    if (strategyType === "macd") {
      if (p.fast) setMacdFast(p.fast);
      if (p.slow) setMacdSlow(p.slow);
      if (p.signal_period) setMacdSignal(p.signal_period);
    } else if (strategyType === "rsi") {
      if (p.period) setRsiPeriod(p.period);
      if (p.oversold) setRsiOversold(p.oversold);
      if (p.overbought) setRsiOverbought(p.overbought);
    }
  }

  function handleWorkflowNext() {
    updateWorkflow({
      backtestSharpe: result?.sharpe_ratio ?? null,
      backtestPnlPct: result?.total_pnl_pct ?? null,
    });
    router.push("/portfolio");
  }

  function currentStrategyParams(): StrategyParams {
    if (mode === "single") {
      return { type: "ema_cross", fast, slow };
    }
    return { type: "gated", rules };
  }

  // ── Layout ───────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Backtest</h1>
          <p className="text-text-3 text-sm mt-0.5">Run and analyze EMA cross strategies with optional gating conditions</p>
        </div>
        <div className="flex gap-4 text-xs pt-1">
          <Link href="/experiments" className="text-text-3 hover:text-accent no-underline transition-colors">
            Experiments →
          </Link>
          <Link href="/backtest/heatmap" className="text-text-3 hover:text-accent no-underline transition-colors">
            Heatmap →
          </Link>
          <button
            onClick={() => setShowSaveStrategy(v => !v)}
            className="text-text-3 hover:text-accent text-xs bg-transparent border-0 cursor-pointer transition-colors"
          >
            Save Strategy
          </button>
        </div>
      </div>

      {/* ── Top Control Panel ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <StrategyModeTabs mode={mode} onChange={setMode} />
          <ScenarioSelect onStartChange={setStart} onEndChange={setEnd} />
        </div>

        <StrategyControlPanel
          instrumentId={instrumentId} onInstrumentChange={setInstrumentId}
          start={start} end={end} onStartChange={setStart} onEndChange={setEnd}
          timeframe={timeframe} onTimeframeChange={setTimeframe}
          benchmarkId={benchmarkId} onBenchmarkChange={setBenchmarkId}
          onRun={run} loading={loading}
        >
          {mode === "single" && (
            <div className="flex flex-col gap-2">
              {/* Strategy type selector */}
              <div className="flex gap-1">
                {(["ema_cross", "macd", "rsi"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setStrategyType(type); setOptimizeResult(null); }}
                    className={
                      `px-2 py-0.5 rounded border text-xs transition-colors ` +
                      (strategyType === type
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-3 hover:text-text-2 bg-transparent")
                    }
                  >
                    {type === "ema_cross" ? "EMA Cross" : type === "macd" ? "MACD" : "RSI"}
                  </button>
                ))}
              </div>

              {/* EMA Cross params */}
              {strategyType === "ema_cross" && (
                <SingleStrategyForm fast={fast} slow={slow} onFastChange={setFast} onSlowChange={setSlow} />
              )}

              {/* MACD params */}
              {strategyType === "macd" && (
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1 text-text-3 text-xs">
                    Fast
                    <input
                      type="number"
                      value={macdFast}
                      onChange={e => setMacdFast(Number(e.target.value))}
                      className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-text-1 text-xs text-right"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-text-3 text-xs">
                    Slow
                    <input
                      type="number"
                      value={macdSlow}
                      onChange={e => setMacdSlow(Number(e.target.value))}
                      className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-text-1 text-xs text-right"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-text-3 text-xs">
                    Signal
                    <input
                      type="number"
                      value={macdSignal}
                      onChange={e => setMacdSignal(Number(e.target.value))}
                      className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-text-1 text-xs text-right"
                    />
                  </label>
                  <button
                    onClick={optimize}
                    disabled={optimizing}
                    className="bg-accent text-black px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    {optimizing ? "Optimizing…" : "Optimize"}
                  </button>
                </div>
              )}

              {/* RSI params */}
              {strategyType === "rsi" && (
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1 text-text-3 text-xs">
                    Period
                    <input
                      type="number"
                      value={rsiPeriod}
                      onChange={e => setRsiPeriod(Number(e.target.value))}
                      className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-text-1 text-xs text-right"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-text-3 text-xs">
                    Oversold
                    <input
                      type="number"
                      value={rsiOversold}
                      onChange={e => setRsiOversold(Number(e.target.value))}
                      className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-text-1 text-xs text-right"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-text-3 text-xs">
                    Overbought
                    <input
                      type="number"
                      value={rsiOverbought}
                      onChange={e => setRsiOverbought(Number(e.target.value))}
                      className="w-12 bg-bg border border-border rounded px-1 py-0.5 text-text-1 text-xs text-right"
                    />
                  </label>
                  <button
                    onClick={optimize}
                    disabled={optimizing}
                    className="bg-accent text-black px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    {optimizing ? "Optimizing…" : "Optimize"}
                  </button>
                </div>
              )}

              {/* Optimize result */}
              {optimizeResult && (
                <div className="flex items-center gap-2">
                  <span className="text-text-3 text-xs">
                    Best: Sharpe {optimizeResult.best_sharpe?.toFixed(2) ?? "N/A"}
                    {strategyType === "macd" && optimizeResult.best_params.fast !== undefined && (
                      <> | Fast={optimizeResult.best_params.fast} Slow={optimizeResult.best_params.slow} Signal={optimizeResult.best_params.signal_period}</>
                    )}
                    {strategyType === "rsi" && optimizeResult.best_params.period !== undefined && (
                      <> | Period={optimizeResult.best_params.period} Oversold={optimizeResult.best_params.oversold} Overbought={optimizeResult.best_params.overbought}</>
                    )}
                    {" "}({optimizeResult.combinations_tested} combos)
                  </span>
                  <button
                    onClick={applyBestParams}
                    className="text-xs text-accent border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
          {mode === "composite" && (
            <CompositeStrategyBuilder rules={rules} instrumentId={instrumentId} onChange={setRules} />
          )}
        </StrategyControlPanel>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {showSaveStrategy && (
        <SaveStrategyForm
          params={currentStrategyParams()}
          onSaved={() => setShowSaveStrategy(false)}
          onCancel={() => setShowSaveStrategy(false)}
        />
      )}

      {/* ── Bottom Analytics (2-col) ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Chart */}
        <ChartPanel
          bars={bars}
          trades={result?.trades ?? []}
          emaFast={mode === "single" ? fast : undefined}
          emaSlow={mode === "single" ? slow : undefined}
          symbol={instrumentId}
          timeframe={timeframe}
          mode={mode}
        />

        {/* Right: Stats + Trade Log */}
        <div className="space-y-4">
          {/* KPI Metrics */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">Performance</span>
            </div>
            <MetricGrid result={result} />
            {result !== null && !showSaveResult && !resultSaved && (
              <div className="px-4 py-2 border-t border-border">
                <button
                  onClick={() => setShowSaveResult(true)}
                  className="text-text-3 hover:text-accent text-xs transition-colors"
                >
                  Save Result
                </button>
              </div>
            )}
            {result !== null && resultSaved && (
              <div className="px-4 py-2 border-t border-border">
                <span className="text-pos text-xs">Saved ✓</span>
              </div>
            )}
            {result !== null && showSaveResult && (
              <div className="px-4 py-2 border-t border-border">
                <div className="flex gap-2 items-center">
                  <input
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    className="flex-1 bg-bg border border-border rounded px-2 py-0.5 text-text-1 text-xs min-w-0"
                    placeholder="Label"
                  />
                  <button
                    onClick={() => {
                      const saved = saveBacktestResult({
                        label: saveLabel.trim() || `${instrumentId} ${start}`,
                        instrumentId,
                        start,
                        end,
                        strategy: (mode === "single" ? "ema_cross" : "gated") as "ema_cross" | "gated",
                        ...(mode === "single" && strategyType === "ema_cross" ? { fast, slow } : {}),
                        result,
                      });
                      setShowSaveResult(false);
                      if (saved !== null) setResultSaved(true);
                    }}
                    className="text-xs text-accent border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 transition-colors whitespace-nowrap"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveResult(false)}
                    className="text-xs text-text-3 hover:text-text-2 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trade Log */}
          <TradeLogTable trades={result?.trades ?? []} />
        </div>
      </div>

      {result !== null && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Workflow</div>
            <p className="text-text-1 text-sm font-medium mt-0.5">Backtest complete — optimise your portfolio weights next</p>
          </div>
          <button
            onClick={handleWorkflowNext}
            className="px-4 py-1.5 text-xs font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0 whitespace-nowrap flex-shrink-0"
          >
            → Optimise Portfolio
          </button>
        </div>
      )}
    </div>
  );
}
