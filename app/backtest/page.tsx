"use client";

import { useRef, useState } from "react";
import { ApiError, getBars, getBacktest, type BarOut, type BacktestResponse } from "@/lib/api";
import { logActivity } from "@/lib/dashboard-storage";
import {
  buildSpawnRules,
  newRule,
  type Mode,
  type SpawnRuleState,
} from "@/lib/backtest-types";
import {
  StrategyModeTabs,
  StrategyControlPanel,
  SingleStrategyForm,
  CompositeStrategyBuilder,
  ChartPanel,
  MetricGrid,
  TradeLogTable,
} from "@/components/ui";

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
  const abortRef = useRef<AbortController | null>(null);

  // ── Business logic (unchanged from original) ─────────────────────
  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      let strategy: string;
      let strategyParams: Record<string, string>;
      if (mode === "single") {
        strategy = "ema_cross";
        strategyParams = { fast: String(fast), slow: String(slow) };
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
      logActivity({
        type: "backtest",
        label: mode === "single"
          ? `${instrumentId} EMA ${fast}/${slow}`
          : `${instrumentId} Gated (${rules.length} rule${rules.length !== 1 ? "s" : ""})`,
        href: "/backtest",
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setBars([]); setResult(null);
    } finally { setLoading(false); }
  }

  // ── Layout ───────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      {/* Page title */}
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Strategy Backtest</h1>
        <p className="text-text-3 text-sm mt-0.5">Run and analyze EMA cross strategies with optional gating conditions</p>
      </div>

      {/* ── Top Control Panel ─────────────────────────────────────── */}
      <div className="space-y-3">
        <StrategyModeTabs mode={mode} onChange={setMode} />

        <StrategyControlPanel
          instrumentId={instrumentId} onInstrumentChange={setInstrumentId}
          start={start} end={end} onStartChange={setStart} onEndChange={setEnd}
          timeframe={timeframe} onTimeframeChange={setTimeframe}
          benchmarkId={benchmarkId} onBenchmarkChange={setBenchmarkId}
          onRun={run} loading={loading}
        >
          {mode === "single" && (
            <SingleStrategyForm fast={fast} slow={slow} onFastChange={setFast} onSlowChange={setSlow} />
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
          </div>

          {/* Trade Log */}
          <TradeLogTable trades={result?.trades ?? []} />
        </div>
      </div>
    </div>
  );
}
