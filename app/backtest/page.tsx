"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { updateWorkflow } from "@/lib/workflow-storage";
import { ApiError, getBars, getBacktest, runBacktestOptimize, runPortfolioBacktest, type BarOut, type BacktestResponse, type OptimizeResponse, type PortfolioBacktestResponse } from "@/lib/api";
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
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
import { PageBanner } from "@/components/PageBanner";

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
  const searchParams = useSearchParams();

  // Strategy type selector
  const [strategyType, setStrategyType] = useState<"ema_cross" | "macd" | "rsi" | "xgb">("ema_cross");

  // MACD params
  const [macdFast, setMacdFast]     = useState(12);
  const [macdSlow, setMacdSlow]     = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  // RSI params
  const [rsiPeriod, setRsiPeriod]         = useState(14);
  const [rsiOversold, setRsiOversold]     = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);

  // XGBoost params
  const [xgbTrainRatio, setXgbTrainRatio]     = useState(0.7);
  const [xgbNEstimators, setXgbNEstimators]   = useState(100);
  const [xgbMaxDepth, setXgbMaxDepth]         = useState(4);
  const [xgbLearningRate, setXgbLearningRate] = useState(0.1);

  // Optimize state
  const [optimizing, setOptimizing]           = useState(false);
  const [optimizeResult, setOptimizeResult]   = useState<OptimizeResponse | null>(null);
  const optimizeCtrlRef = useRef<AbortController | null>(null);

  // Portfolio state
  const [portfolioInstruments, setPortfolioInstruments] = useState("AAPL.NASDAQ,SPY.ARCA");
  const [portfolioResult, setPortfolioResult]           = useState<PortfolioBacktestResponse | null>(null);
  const [portfolioLoading, setPortfolioLoading]         = useState(false);
  const [portfolioError, setPortfolioError]             = useState<string | null>(null);
  const portfolioCtrlRef = useRef<AbortController | null>(null);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (optimizeCtrlRef.current) optimizeCtrlRef.current.abort();
      portfolioCtrlRef.current?.abort();
    };
  }, []);

  // Pre-fill from URL query params (e.g. from AI Trader "Open Backtest →" link)
  useEffect(() => {
    const strategy = searchParams.get("strategy");
    if (!strategy) return;
    if (strategy === "macd") {
      setStrategyType("macd");
      const fast = searchParams.get("fast");
      const slow = searchParams.get("slow");
      const signal = searchParams.get("signal_period");
      if (fast) setMacdFast(parseInt(fast));
      if (slow) setMacdSlow(parseInt(slow));
      if (signal) setMacdSignal(parseInt(signal));
    } else if (strategy === "rsi") {
      setStrategyType("rsi");
      const period = searchParams.get("period");
      const oversold = searchParams.get("oversold");
      const overbought = searchParams.get("overbought");
      if (period) setRsiPeriod(parseInt(period));
      if (oversold) setRsiOversold(parseFloat(oversold));
      if (overbought) setRsiOverbought(parseFloat(overbought));
    } else if (strategy === "ema_cross") {
      setStrategyType("ema_cross");
      const fast = searchParams.get("fast");
      const slow = searchParams.get("slow");
      if (fast) setFast(parseInt(fast));
      if (slow) setSlow(parseInt(slow));
    } else if (strategy === "xgb") {
      setStrategyType("xgb");
      const trainRatio = searchParams.get("xgb_train_ratio");
      const nEstimators = searchParams.get("xgb_n_estimators");
      const maxDepth = searchParams.get("xgb_max_depth");
      const learningRate = searchParams.get("xgb_learning_rate");
      if (trainRatio) setXgbTrainRatio(parseFloat(trainRatio));
      if (nEstimators) setXgbNEstimators(parseInt(nEstimators));
      if (maxDepth) setXgbMaxDepth(parseInt(maxDepth));
      if (learningRate) setXgbLearningRate(parseFloat(learningRate));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Business logic ───────────────────────────────────────────────
  async function run() {
    if (mode === "portfolio") return;
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
        } else if (strategyType === "xgb") {
          strategy = "xgb";
          strategyParams = {
            xgb_train_ratio: String(xgbTrainRatio),
            xgb_n_estimators: String(xgbNEstimators),
            xgb_max_depth: String(xgbMaxDepth),
            xgb_learning_rate: String(xgbLearningRate),
          };
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
          : strategyType === "xgb"
          ? `${instrumentId} XGBoost ${xgbTrainRatio}/${xgbNEstimators}/${xgbMaxDepth} ${start}→${end}`
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
              : strategyType === "xgb"
              ? `${instrumentId} XGBoost`
              : `${instrumentId} EMA ${fast}/${slow}`)
          : `${instrumentId} Gated (${rules.length} rule${rules.length !== 1 ? "s" : ""})`;
      logActivity({
        type: "backtest",
        label: activityLabel,
        href: "/backtest",
      });
      const experimentLabel =
        mode === "single"
          ? strategyType === "macd"
            ? { strategy: "macd" as ExperimentStrategy, instrumentId, macdFast, macdSlow, macdSignal }
            : strategyType === "rsi"
            ? { strategy: "rsi" as ExperimentStrategy, instrumentId, rsiPeriod }
            : strategyType === "xgb"
            ? { strategy: "xgb" as ExperimentStrategy, instrumentId, xgbTrainRatio, xgbNEstimators, xgbMaxDepth }
            : { strategy: "ema_cross" as ExperimentStrategy, instrumentId, fast, slow }
          : { strategy: "gated" as ExperimentStrategy, instrumentId, rulesCount: rules.length };
      const experimentParams: Record<string, any> =
        mode === "single"
          ? strategyType === "macd"
            ? { macdFast, macdSlow, macdSignal }
            : strategyType === "rsi"
            ? { rsiPeriod, rsiOversold, rsiOverbought }
            : strategyType === "xgb"
            ? { xgbTrainRatio, xgbNEstimators, xgbMaxDepth, xgbLearningRate }
            : { fast, slow }
          : { rulesCount: rules.length };
      saveExperiment({
        label: makeExperimentLabel(experimentLabel),
        params: {
          strategy: (mode === "single" ? strategyType : "gated") as ExperimentStrategy,
          instrumentId,
          start,
          end,
          timeframe,
          benchmarkId,
          ...experimentParams,
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

  async function runPortfolio() {
    portfolioCtrlRef.current?.abort();
    const ctrl = new AbortController();
    portfolioCtrlRef.current = ctrl;
    setPortfolioLoading(true);
    setPortfolioError(null);
    setPortfolioResult(null);

    const ids = portfolioInstruments.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      setPortfolioError("Enter at least one instrument ID");
      if (!ctrl.signal.aborted) setPortfolioLoading(false);
      return;
    }

    const params: Record<string, string> = {};
    if (strategyType === "macd") {
      params.fast = String(macdFast);
      params.slow = String(macdSlow);
      params.signal_period = String(macdSignal);
    } else if (strategyType === "rsi") {
      params.period = String(rsiPeriod);
      params.oversold = String(rsiOversold);
      params.overbought = String(rsiOverbought);
    } else {
      params.fast = String(fast);
      params.slow = String(slow);
    }

    try {
      const res = await runPortfolioBacktest(ids, start, end, strategyType, params, ctrl.signal);
      if (!ctrl.signal.aborted) setPortfolioResult(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted) {
        setPortfolioError(err instanceof ApiError ? err.message : "Portfolio backtest failed");
      }
    } finally {
      if (!ctrl.signal.aborted) setPortfolioLoading(false);
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
      <PageBanner pageKey="backtest" />
      {/* Page title */}
      <div className="flex justify-end gap-4 text-xs">
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
                <button
                  onClick={() => { setStrategyType("xgb"); setOptimizeResult(null); }}
                  className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                    strategyType === "xgb"
                      ? "bg-accent/10 text-accent border border-accent"
                      : "text-text-3 hover:text-text-1 border border-transparent"
                  }`}
                >
                  XGBoost (ML)
                </button>
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

              {/* XGBoost params */}
              {strategyType === "xgb" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-text-3 text-[10px] uppercase tracking-wider block mb-1">Train Ratio</label>
                    <input
                      type="number"
                      min="0.5"
                      max="0.9"
                      step="0.05"
                      value={xgbTrainRatio}
                      onChange={e => setXgbTrainRatio(parseFloat(e.target.value))}
                      className="w-full bg-panel-2 border border-border rounded px-2 py-1 text-text-1 text-xs font-data"
                    />
                  </div>
                  <div>
                    <label className="text-text-3 text-[10px] uppercase tracking-wider block mb-1">Trees</label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      step="10"
                      value={xgbNEstimators}
                      onChange={e => setXgbNEstimators(parseInt(e.target.value))}
                      className="w-full bg-panel-2 border border-border rounded px-2 py-1 text-text-1 text-xs font-data"
                    />
                  </div>
                  <div>
                    <label className="text-text-3 text-[10px] uppercase tracking-wider block mb-1">Max Depth</label>
                    <input
                      type="number"
                      min="2"
                      max="10"
                      step="1"
                      value={xgbMaxDepth}
                      onChange={e => setXgbMaxDepth(parseInt(e.target.value))}
                      className="w-full bg-panel-2 border border-border rounded px-2 py-1 text-text-1 text-xs font-data"
                    />
                  </div>
                  <div>
                    <label className="text-text-3 text-[10px] uppercase tracking-wider block mb-1">Learning Rate</label>
                    <input
                      type="number"
                      min="0.01"
                      max="0.5"
                      step="0.01"
                      value={xgbLearningRate}
                      onChange={e => setXgbLearningRate(parseFloat(e.target.value))}
                      className="w-full bg-panel-2 border border-border rounded px-2 py-1 text-text-1 text-xs font-data"
                    />
                  </div>
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
          {mode === "portfolio" && (
            <div className="space-y-4">
              {/* Instruments */}
              <div className="flex flex-col gap-1">
                <label className="text-text-3 text-xs">Instrument IDs (comma-separated)</label>
                <input
                  value={portfolioInstruments}
                  onChange={e => setPortfolioInstruments(e.target.value)}
                  className="bg-panel border border-border rounded px-2 py-1 text-text-1 text-sm w-full"
                  placeholder="AAPL.NASDAQ,SPY.ARCA"
                />
              </div>

              {/* Strategy type selector */}
              <div className="flex gap-2">
                {(["ema_cross", "macd", "rsi"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStrategyType(s)}
                    className={[
                      "px-3 py-1 text-xs rounded border transition-colors cursor-pointer",
                      strategyType === s
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-3 hover:text-text-2",
                    ].join(" ")}
                  >
                    {s === "ema_cross" ? "EMA Cross" : s.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Strategy params */}
              {strategyType === "macd" && (
                <div className="flex gap-3 items-center flex-wrap">
                  <label className="text-text-3 text-xs">Fast</label>
                  <input type="number" value={macdFast} onChange={e => setMacdFast(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                  <label className="text-text-3 text-xs">Slow</label>
                  <input type="number" value={macdSlow} onChange={e => setMacdSlow(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                  <label className="text-text-3 text-xs">Signal</label>
                  <input type="number" value={macdSignal} onChange={e => setMacdSignal(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                </div>
              )}
              {strategyType === "rsi" && (
                <div className="flex gap-3 items-center flex-wrap">
                  <label className="text-text-3 text-xs">Period</label>
                  <input type="number" value={rsiPeriod} onChange={e => setRsiPeriod(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                  <label className="text-text-3 text-xs">Oversold</label>
                  <input type="number" value={rsiOversold} onChange={e => setRsiOversold(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                  <label className="text-text-3 text-xs">Overbought</label>
                  <input type="number" value={rsiOverbought} onChange={e => setRsiOverbought(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                </div>
              )}
              {strategyType === "ema_cross" && (
                <div className="flex gap-3 items-center flex-wrap">
                  <label className="text-text-3 text-xs">Fast</label>
                  <input type="number" value={fast} onChange={e => setFast(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                  <label className="text-text-3 text-xs">Slow</label>
                  <input type="number" value={slow} onChange={e => setSlow(Number(e.target.value))}
                    className="bg-panel border border-border rounded px-1 py-0.5 text-text-1 text-sm w-12" />
                </div>
              )}

              {/* Run button */}
              <button
                onClick={runPortfolio}
                disabled={portfolioLoading}
                className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {portfolioLoading ? "Running…" : "Run Portfolio Backtest"}
              </button>

              {portfolioError && (
                <p className="text-neg text-sm">{portfolioError}</p>
              )}

              {/* Results */}
              {portfolioResult && (
                <div className="space-y-4 mt-4">
                  {/* Portfolio stats */}
                  <div className="flex gap-6 flex-wrap">
                    <div>
                      <p className="text-text-3 text-xs">Total PnL</p>
                      <p className="text-text-1 text-sm font-medium">
                        {portfolioResult.portfolio_total_pnl != null
                          ? `$${portfolioResult.portfolio_total_pnl.toFixed(2)}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-3 text-xs">Max Drawdown</p>
                      <p className="text-neg text-sm font-medium">
                        {portfolioResult.portfolio_max_drawdown != null
                          ? `${(portfolioResult.portfolio_max_drawdown * 100).toFixed(2)}%`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-3 text-xs">Sharpe</p>
                      <p className="text-text-1 text-sm font-medium">
                        {portfolioResult.portfolio_sharpe != null
                          ? portfolioResult.portfolio_sharpe.toFixed(2)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Equity curve */}
                  <div className="bg-panel border border-border rounded-lg p-3">
                    <p className="text-text-3 text-xs mb-2">Portfolio Equity Curve</p>
                    <div style={{ height: "200px" }}>
                      <RollingChart
                        series={[{
                          label: "Portfolio Equity",
                          color: "#22C55E",
                          points: portfolioResult.portfolio_equity.map(ep => ({
                            ts_ns: ep.ts_ns,
                            value: ep.equity,
                          })),
                        }]}
                        yFormat={v => `$${v.toFixed(2)}`}
                        height={200}
                      />
                    </div>
                  </div>

                  {/* Per-instrument summary table */}
                  <div className="bg-panel border border-border rounded-lg overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-text-3 text-xs">
                          <th className="px-3 py-2 text-left">Instrument</th>
                          <th className="px-3 py-2 text-right">Sharpe</th>
                          <th className="px-3 py-2 text-right">Total PnL</th>
                          <th className="px-3 py-2 text-right">PnL%</th>
                          <th className="px-3 py-2 text-right">Max DD</th>
                          <th className="px-3 py-2 text-right">Win Rate</th>
                          <th className="px-3 py-2 text-right">Trades</th>
                          <th className="px-3 py-2 text-right">Bars</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioResult.results.map(r => (
                          <tr key={r.instrument_id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-text-1">{r.instrument_id}</td>
                            <td className="px-3 py-2 text-right text-text-2">
                              {r.sharpe_ratio != null ? r.sharpe_ratio.toFixed(2) : "—"}
                            </td>
                            <td className={`px-3 py-2 text-right ${r.total_pnl != null && r.total_pnl >= 0 ? "text-pos" : "text-neg"}`}>
                              {r.total_pnl != null ? `$${r.total_pnl.toFixed(2)}` : "—"}
                            </td>
                            <td className={`px-3 py-2 text-right ${r.total_pnl_pct != null && r.total_pnl_pct >= 0 ? "text-pos" : "text-neg"}`}>
                              {r.total_pnl_pct != null ? `${(r.total_pnl_pct * 100).toFixed(2)}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-neg">
                              {r.max_drawdown != null ? `${(r.max_drawdown * 100).toFixed(2)}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-text-2">
                              {r.win_rate != null ? `${(r.win_rate * 100).toFixed(1)}%` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-text-2">{r.trade_count}</td>
                            <td className="px-3 py-2 text-right text-text-2">{r.bar_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
          mode={mode !== "portfolio" ? mode : undefined}
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
                      const resultParams: Record<string, any> =
                        mode === "single"
                          ? strategyType === "macd"
                            ? { macdFast, macdSlow, macdSignal }
                            : strategyType === "rsi"
                            ? { rsiPeriod, rsiOversold, rsiOverbought }
                            : { fast, slow }
                          : {};
                      const saved = saveBacktestResult({
                        label: saveLabel.trim() || `${instrumentId} ${start}`,
                        instrumentId,
                        start,
                        end,
                        strategy: (mode === "single" ? strategyType : "gated") as "ema_cross" | "gated" | "macd" | "rsi" | "xgb",
                        ...resultParams,
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
