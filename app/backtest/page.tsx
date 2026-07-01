"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { updateWorkflow } from "@/lib/workflow-storage";
import { ApiError, getBars, getBacktest, runBacktestOptimize, runPortfolioBacktest, type BarOut, type BacktestResponse, type OptimizeResponse, type PortfolioBacktestResponse, type TradeRecord } from "@/lib/api";
import { logActivity } from "@/lib/dashboard-storage";
import { saveBacktestResult } from "@/lib/backtest-result-storage";
import { toast } from "@/lib/toast";
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
import { StrategyComparePanel } from "@/components/backtest/StrategyComparePanel";
import { WalkForwardPanel } from "@/components/backtest/WalkForwardPanel";
import { PositionSizingPanel } from "@/components/backtest/PositionSizingPanel";
import { MonteCarloPanel } from "@/components/backtest/MonteCarloPanel";
import { TradeAnalyticsPanel } from "@/components/backtest/TradeAnalyticsPanel";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
import { PageBanner } from "@/components/PageBanner";
import { computeRunningStats } from "@/lib/replay-utils";
import { ReplayChart } from "@/components/replay/ReplayChart";

function BacktestPageInner() {
  const [mode, setMode]               = useState<Mode>("single");
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart]             = useState("2025-06-25");
  const [end, setEnd]                 = useState("2026-06-23");
  const [timeframe, setTimeframe]     = useState("1D");
  const [fast, setFast]               = useState(10);
  const [slow, setSlow]               = useState(20);
  const [benchmarkId, setBenchmarkId] = useState("");
  const [costBps, setCostBps]         = useState("5");  // 현실 거래비용 (체결당 bps)
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

  // Pre-fill from URL query params
  useEffect(() => {
    const instrument = searchParams.get("instrument");
    const startParam  = searchParams.get("start");
    const endParam    = searchParams.get("end");
    if (instrument) setInstrumentId(instrument);
    if (startParam)  setStart(startParam);
    if (endParam)    setEnd(endParam);

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
      // 현실 거래비용(슬리피지+수수료) — macd/rsi/xgb 심플 러너에 반영
      if (["macd", "rsi", "xgb"].includes(strategy)) {
        strategyParams.cost_bps = String(parseFloat(costBps) || 0);
      }
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, timeframe, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, strategyParams, benchmarkId || undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setResult(btRes);
      const sharpeStr = btRes.sharpe_ratio != null ? ` | Sharpe ${btRes.sharpe_ratio.toFixed(2)}` : "";
      const pnlStr = btRes.total_pnl_pct != null ? ` | PnL ${btRes.total_pnl_pct >= 0 ? "+" : ""}${btRes.total_pnl_pct.toFixed(1)}%` : "";
      toast.show(`백테스트 완료 ${sharpeStr}${pnlStr}`, "success");
      updateWorkflow({
        backtestSharpe: btRes.sharpe_ratio ?? null,
        backtestPnlPct: btRes.total_pnl_pct ?? null,
        strategyId: strategy,
      });
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
      const msg = e instanceof ApiError ? e.message : "백테스트 실패";
      setError(msg);
      toast.show(msg, "error");
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

              {/* 현실 거래비용 (macd/rsi/xgb 반영) */}
              {strategyType !== "ema_cross" && (
                <div className="flex items-center gap-2">
                  <label className="text-text-3 text-xs">거래비용</label>
                  <input value={costBps} onChange={e => setCostBps(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    className="w-16 bg-panel-2 border border-border rounded px-2 py-1 text-text-1 text-xs font-data text-center outline-none focus:border-accent" />
                  <span className="text-text-3 text-[10px]">bps/체결 (슬리피지+수수료, 왕복 2회). 실전 함정 방지</span>
                </div>
              )}

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
              <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setShowSaveResult(true)}
                  className="text-text-3 hover:text-accent text-xs transition-colors bg-transparent border-0 cursor-pointer"
                >
                  Save Result
                </button>
                <button
                  onClick={() => router.push(`/orders?symbol=${encodeURIComponent(instrumentId)}`)}
                  className="px-3 h-6 text-xs font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0"
                >
                  주문하기 →
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

          {/* Trade Analytics */}
          {mode === "single" && result !== null && (
            <TradeAnalyticsPanel trades={result.trades} />
          )}

          {/* Strategy Comparison */}
          {mode === "single" && (
            <StrategyComparePanel
              instrumentId={instrumentId}
              start={start}
              end={end}
            />
          )}

          {/* Monte Carlo Simulation */}
          {mode === "single" && result !== null && (
            <MonteCarloPanel
              instrumentId={instrumentId}
              start={start}
              end={end}
            />
          )}

          {/* Position Sizing Calculator */}
          {mode === "single" && result !== null && (
            <PositionSizingPanel
              winRate={result.win_rate}
              avgWin={result.avg_win}
              avgLoss={result.avg_loss}
            />
          )}

          {/* Walk-Forward Analysis */}
          {mode === "single" && result !== null && (
            <WalkForwardPanel
              instrumentId={instrumentId}
              start={start}
              end={end}
              strategy={strategyType}
              strategyParams={
                strategyType === "macd"
                  ? { fast: String(macdFast), slow: String(macdSlow), signal_period: String(macdSignal) }
                  : strategyType === "rsi"
                  ? { period: String(rsiPeriod), oversold: String(rsiOversold), overbought: String(rsiOverbought) }
                  : strategyType === "xgb"
                  ? { xgb_train_ratio: String(xgbTrainRatio), xgb_n_estimators: String(xgbNEstimators), xgb_max_depth: String(xgbMaxDepth), xgb_learning_rate: String(xgbLearningRate) }
                  : { fast: String(fast), slow: String(slow) }
              }
            />
          )}
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

// ── Replay ───────────────────────────────────────────────────────────

type SpeedMs = 1000 | 500 | 250;
const SPEED_OPTIONS: { label: string; ms: SpeedMs }[] = [
  { label: "1x", ms: 1000 },
  { label: "2x", ms: 500 },
  { label: "4x", ms: 250 },
];

function ReplayContent() {
  const [instrumentId, setInstrumentId] = useState("005930.XKRX");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState("2026-01-01");
  const [strategy, setStrategy] = useState("ema_cross");
  const [fastEma, setFastEma] = useState("10");
  const [slowEma, setSlowEma] = useState("30");
  const [bars, setBars] = useState<BarOut[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMs>(1000);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradesRef = useRef<TradeRecord[]>([]);
  tradesRef.current = trades;

  useEffect(() => () => {
    abortRef.current?.abort();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setBars([]);
    setTrades([]);
    setCurrentIndex(-1);
    try {
      const [barsRes, btRes] = await Promise.all([
        getBars(instrumentId, start, end, undefined, ctrl.signal),
        getBacktest(instrumentId, start, end, strategy, { fast_ema: fastEma, slow_ema: slowEma }, undefined, ctrl.signal),
      ]);
      setBars(barsRes.bars);
      setTrades(btRes.trades);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to run backtest");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, start, end, strategy, fastEma, slowEma]);

  function stopPlayback() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsPlaying(false);
  }

  function startPlayback() {
    if (intervalRef.current) { clearInterval(intervalRef.current); }
    setCurrentIndex(prev => prev >= tradesRef.current.length - 1 ? -1 : prev);
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= tradesRef.current.length - 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
  }

  const goFirst = () => { stopPlayback(); setCurrentIndex(-1); };
  const goPrev = () => setCurrentIndex(i => Math.max(-1, i - 1));
  const goNext = () => setCurrentIndex(i => Math.min(trades.length - 1, i + 1));
  const goLast = () => { stopPlayback(); setCurrentIndex(trades.length - 1); };

  const stats = useMemo(() => computeRunningStats(trades, currentIndex), [trades, currentIndex]);

  const hasTrades = trades.length > 0;
  const tradeLabel = hasTrades
    ? currentIndex < 0
      ? `— / ${trades.length}`
      : `Trade ${currentIndex + 1} / ${trades.length}`
    : "No trades";

  function fmtPnl(v: number): string {
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  }

  function fmtPct(v: number | null): string {
    return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input value={instrumentId} onChange={e => setInstrumentId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-36" />
          </div>
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
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Strategy</label>
            <input value={strategy} onChange={e => setStrategy(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-28" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Fast EMA</label>
            <input type="number" value={fastEma} onChange={e => setFastEma(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Slow EMA</label>
            <input type="number" value={slowEma} onChange={e => setSlowEma(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-16" />
          </div>
          <button onClick={run} disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{error}</div>
      )}

      {hasTrades && (
        <>
          {/* Running stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Trades Shown", value: `${stats.totalTrades}/${trades.length}`, colored: false, val: 0 },
              { label: "Completed", value: String(stats.completedTrades), colored: false, val: 0 },
              { label: "Running P&L", value: fmtPnl(stats.runningPnl), colored: true, val: stats.runningPnl },
              { label: "Win Rate", value: fmtPct(stats.winRate), colored: false, val: 0 },
            ].map(s => (
              <div key={s.label} className="bg-panel border border-border rounded-lg px-4 py-3">
                <div className="text-text-3 text-[10px] uppercase tracking-wider">{s.label}</div>
                <div className={`text-sm font-data mt-1 ${s.colored ? (s.val >= 0 ? "text-pos" : "text-neg") : "text-text-1"}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Chart + trade list */}
          <div className="flex gap-4">
            {/* Chart column */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="bg-bg border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">{instrumentId} — {tradeLabel}</span>
                </div>
                <div className="p-2">
                  <ReplayChart bars={bars} trades={trades} currentIndex={currentIndex} height={360} />
                </div>
              </div>

              {/* Playback controls */}
              <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1">
                  <button onClick={goFirst} disabled={currentIndex <= -1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    |◀
                  </button>
                  <button onClick={goPrev} disabled={currentIndex <= -1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ◀
                  </button>
                  <button
                    onClick={isPlaying ? stopPlayback : startPlayback}
                    disabled={trades.length === 0}
                    className="px-3 py-1 text-xs bg-accent text-black font-semibold rounded cursor-pointer hover:brightness-110 border-0 disabled:opacity-40">
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <button onClick={goNext} disabled={currentIndex >= trades.length - 1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ▶
                  </button>
                  <button onClick={goLast} disabled={currentIndex >= trades.length - 1}
                    className="px-2 py-1 text-xs text-text-3 hover:text-text-1 border border-border rounded cursor-pointer bg-transparent disabled:opacity-40">
                    ▶|
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-text-3 text-xs">Speed:</span>
                  {SPEED_OPTIONS.map(opt => (
                    <button key={opt.ms} onClick={() => setSpeed(opt.ms)}
                      className={`px-2 py-0.5 text-xs rounded border cursor-pointer transition-colors ${
                        speed === opt.ms ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <span className="text-text-3 text-xs ml-auto font-data">{tradeLabel}</span>
              </div>
            </div>

            {/* Trade list panel */}
            <div className="w-56 shrink-0">
              <div className="bg-panel border border-border rounded-lg overflow-hidden h-full">
                <div className="px-3 py-2 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Trades</span>
                </div>
                <div className="overflow-y-auto max-h-96">
                  {trades.map((t, i) => {
                    const isActive = i === currentIndex;
                    const isCompleted = t.pnl !== null;
                    const isWin = t.pnl !== null && t.pnl > 0;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        className={`w-full px-3 py-2 text-left border-b border-border/40 transition-colors cursor-pointer ${
                          isActive ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-panel-2 bg-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-text-3 text-[10px]">#{i + 1}</span>
                          <span className={`text-[10px] font-semibold ${t.side === "LONG" || t.side === "BUY" ? "text-pos" : "text-neg"}`}>
                            {t.side}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-text-3 text-[10px] font-data">{t.entry_price.toFixed(2)}</span>
                          {isCompleted ? (
                            <span className={`text-[10px] font-data font-semibold ${isWin ? "text-pos" : "text-neg"}`}>
                              {fmtPnl(t.pnl!)}
                            </span>
                          ) : (
                            <span className="text-text-3 text-[10px]">open</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!hasTrades && !loading && !error && (
        <div className="text-center py-16 text-text-3 text-sm">
          Configure instrument and click Run to start trade replay.
        </div>
      )}
    </div>
  );
}

// ── Outer tab wrapper ─────────────────────────────────────────────────

function BacktestPageWithTabs() {
  const [outerTab, setOuterTab] = useState<"backtest" | "replay">("backtest");
  return (
    <div className="flex flex-col min-h-full">
      {/* Outer tab bar */}
      <div className="border-b border-border bg-panel flex px-6 gap-0 shrink-0">
        {[
          { id: "backtest", label: "백테스트" },
          { id: "replay",   label: "리플레이" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setOuterTab(t.id as "backtest" | "replay")}
            className={`px-5 py-2.5 text-sm bg-transparent border-0 cursor-pointer transition-colors ${
              outerTab === t.id
                ? "border-b-2 border-accent text-accent font-medium"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {outerTab === "backtest" && <BacktestPageInner />}
      {outerTab === "replay" && <ReplayContent />}
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense>
      <BacktestPageWithTabs />
    </Suspense>
  );
}
