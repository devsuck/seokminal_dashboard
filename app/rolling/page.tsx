"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { getTimeSeries, getRollingBeta, ApiError } from "@/lib/api";
import { PageBanner } from "@/components/PageBanner";
import {
  computeRollingVolatility,
  zipRollingPoints,
  type RollingPoint,
} from "@/lib/rolling-analytics-utils";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";

type Metric = "sharpe" | "beta" | "correlation" | "drawdown" | "volatility";
type WindowOption = 20 | 60 | 90 | 252;

const WINDOW_OPTIONS: WindowOption[] = [20, 60, 90, 252];

const METRIC_OPTIONS: {
  value: Metric;
  label: string;
  color: string;
  unit: string;
}[] = [
  { value: "sharpe",      label: "Rolling Sharpe",      color: "#FF9F1C", unit: "" },
  { value: "beta",        label: "Rolling Beta",         color: "#3B82F6", unit: "" },
  { value: "correlation", label: "Rolling Correlation",  color: "#22C55E", unit: "" },
  { value: "drawdown",    label: "Rolling Drawdown",     color: "#EF4444", unit: "%" },
  { value: "volatility",  label: "Rolling Volatility",   color: "#A78BFA", unit: "%" },
];

const DEFAULT_START = "2022-01-01";
const DEFAULT_END = "2026-01-01";

export default function RollingPage() {
  const [instrumentId, setInstrumentId] = useState("005930.XKRX");
  const [benchmarkId, setBenchmarkId] = useState("KOSPI.XKRX");
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [rollingWindow, setRollingWindow] = useState<WindowOption>(60);
  const [metric, setMetric] = useState<Metric>("sharpe");
  const [tsPoints, setTsPoints] = useState<RollingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Abort on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setTsPoints([]);
    setRan(false);

    try {
      if (metric === "sharpe" || metric === "drawdown" || metric === "volatility") {
        const res = await getTimeSeries(
          instrumentId,
          start,
          end,
          undefined,
          rollingWindow,
          ctrl.signal,
        );
        const pts = res.points;

        if (metric === "sharpe") {
          setTsPoints(pts.map((p) => ({ ts_ns: p.ts_ns, value: p.rolling_sharpe })));
        } else if (metric === "drawdown") {
          setTsPoints(
            pts.map((p) => ({
              ts_ns: p.ts_ns,
              value: p.drawdown * 100,
            })),
          );
        } else {
          // volatility
          const dailyReturns = pts.map((p) => p.daily_return);
          const vols = computeRollingVolatility(dailyReturns, rollingWindow);
          setTsPoints(
            zipRollingPoints(
              pts.map((p) => p.ts_ns),
              vols.map((v) => (v !== null ? v * 100 : null)),
            ),
          );
        }
      } else {
        // beta or correlation — needs benchmark
        const res = await getRollingBeta(
          instrumentId,
          benchmarkId,
          start,
          end,
          rollingWindow,
          ctrl.signal,
        );
        const pts = res.points;
        if (metric === "beta") {
          setTsPoints(pts.map((p) => ({ ts_ns: p.ts_ns, value: p.beta })));
        } else {
          setTsPoints(pts.map((p) => ({ ts_ns: p.ts_ns, value: p.correlation })));
        }
      }
      setRan(true);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed to fetch data");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [instrumentId, benchmarkId, start, end, rollingWindow, metric]);

  const currentMeta = METRIC_OPTIONS.find((m) => m.value === metric)!;

  const chartSeries: RollingSeries[] = useMemo(() => {
    if (!ran || tsPoints.length === 0) return [];
    return [
      {
        label: currentMeta.label,
        color: currentMeta.color,
        points: tsPoints,
      },
    ];
  }, [ran, tsPoints, currentMeta]);

  const { validValues, currentVal, minVal, maxVal, avgVal } = useMemo(() => {
    const validValues = tsPoints.map((p) => p.value).filter((v): v is number => v !== null);
    const currentVal = validValues.length > 0 ? validValues[validValues.length - 1] : null;
    const minVal = validValues.length > 0 ? Math.min(...validValues) : null;
    const maxVal = validValues.length > 0 ? Math.max(...validValues) : null;
    const avgVal =
      validValues.length > 0
        ? validValues.reduce((s, v) => s + v, 0) / validValues.length
        : null;
    return { validValues, currentVal, minVal, maxVal, avgVal };
  }, [tsPoints]);

  function fmt(v: number | null): string {
    if (v === null) return "—";
    return `${v.toFixed(3)}${currentMeta.unit}`;
  }

  const needsBenchmark = metric === "beta" || metric === "correlation";

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <PageBanner pageKey="rolling" />

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument</label>
            <input
              value={instrumentId}
              onChange={(e) => setInstrumentId(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-40"
            />
          </div>
          {needsBenchmark && (
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Benchmark</label>
              <input
                value={benchmarkId}
                onChange={(e) => setBenchmarkId(e.target.value)}
                className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data w-40"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Start</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"
            />
          </div>
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">End</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data"
            />
          </div>
        </div>

        <div className="flex gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-text-3 text-[11px] uppercase tracking-wider">Window</label>
            <div className="flex gap-1">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => setRollingWindow(w)}
                  className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                    rollingWindow === w
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-3 hover:text-text-2 bg-transparent"
                  }`}
                >
                  {w}d
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {ran && (
        <>
          {/* Metric selector */}
          <div className="flex gap-1 flex-wrap">
            {METRIC_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => { setMetric(m.value); setRan(false); setTsPoints([]); }}
                className={`px-3 py-1.5 text-xs rounded border cursor-pointer transition-colors ${
                  metric === m.value
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-text-3 hover:text-text-2 bg-transparent"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-bg border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
              <span className="text-text-3 text-[11px] uppercase tracking-wider">
                {currentMeta.label} — {rollingWindow}d window
              </span>
            </div>
            <div className="p-2">
              <RollingChart series={chartSeries} height={280} />
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Current", value: fmt(currentVal) },
              { label: "Min",     value: fmt(minVal) },
              { label: "Max",     value: fmt(maxVal) },
              { label: "Average", value: fmt(avgVal) },
            ].map((s) => (
              <div key={s.label} className="bg-panel border border-border rounded-lg px-4 py-3">
                <div className="text-text-3 text-[10px] uppercase tracking-wider">{s.label}</div>
                <div className="text-text-1 text-sm font-data mt-1">{s.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!ran && !loading && !error && (
        <div className="text-center py-12 text-text-3 text-sm">
          Configure instrument and click Run to view rolling metrics.
        </div>
      )}
    </div>
  );
}
