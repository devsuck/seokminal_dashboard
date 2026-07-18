"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { getBacktest, type BacktestResponse } from "@/lib/api";
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { PageBanner } from "@/components/PageBanner";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, SegmentedToggle } from "@/components/ui";
import { TOKEN } from "@/lib/chart-colors";

type HeatmapMetric = "sharpe" | "sortino" | "maxDrawdown" | "winRate";

const METRIC_LABELS: Record<HeatmapMetric, string> = {
  sharpe: "Sharpe Ratio",
  sortino: "Sortino Ratio",
  maxDrawdown: "Max Drawdown",
  winRate: "Win Rate",
};

// Lower is better for these metrics — invert color scale
const INVERT_METRIC = new Set<HeatmapMetric>(["maxDrawdown"]);

function rangeArr(min: number, max: number, step: number): number[] {
  const arr: number[] = [];
  for (let v = min; v <= max; v += step) arr.push(v);
  return arr;
}

function getMetricValue(result: BacktestResponse, metric: HeatmapMetric): number | null {
  switch (metric) {
    case "sharpe":      return result.sharpe_ratio;
    case "sortino":     return result.sortino_ratio;
    case "maxDrawdown": return result.max_drawdown;
    case "winRate":     return result.win_rate;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function interpolateColor(t: number): string {
  // Diverging scale built from design tokens: t<0.5 (worse) fades toward TOKEN.neg,
  // t>0.5 (better) fades toward TOKEN.pos. Opacity ~ distance from the neutral midpoint.
  const [r, g, b] = hexToRgb(t >= 0.5 ? TOKEN.pos : TOKEN.neg);
  const intensity = Math.abs(t - 0.5) * 2; // 0 at midpoint, 1 at extremes
  const alpha = 0.15 + intensity * 0.65;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function normalizeT(value: number, min: number, max: number, invert: boolean): number {
  if (max === min) return 0.5;
  const t = (value - min) / (max - min);
  return invert ? 1 - t : t;
}

function formatValue(value: number, metric: HeatmapMetric): string {
  if (metric === "maxDrawdown" || metric === "winRate") {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(2);
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HeatmapPage() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [fastMin, setFastMin] = useState(5);
  const [fastMax, setFastMax] = useState(30);
  const [fastStep, setFastStep] = useState(5);
  const [slowMin, setSlowMin] = useState(20);
  const [slowMax, setSlowMax] = useState(100);
  const [slowStep, setSlowStep] = useState(10);
  const [metric, setMetric] = useState<HeatmapMetric>("sharpe");
  const [results, setResults] = useState<Record<string, number | null>>({});
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runHeatmap() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const fastValues = rangeArr(fastMin, fastMax, fastStep);
    const slowValues = rangeArr(slowMin, slowMax, slowStep);
    const pairs: [number, number][] = [];
    for (const f of fastValues) {
      for (const s of slowValues) {
        if (f < s) pairs.push([f, s]);
      }
    }

    if (pairs.length === 0) {
      setError("No valid combinations: all fast values must be less than slow values.");
      return;
    }
    if (pairs.length > 100) {
      setError(`${pairs.length} combinations exceeds limit of 100. Reduce range or increase step.`);
      return;
    }

    setRunning(true);
    setError(null);
    setResults({});
    setProgress(0);
    setTotal(pairs.length);

    const newResults: Record<string, number | null> = {};
    let completed = 0;
    const queue = [...pairs];

    async function worker() {
      while (queue.length > 0) {
        const pair = queue.shift();
        if (!pair || ctrl.signal.aborted) break;
        const [f, s] = pair;
        const key = `${f}-${s}`;
        try {
          const res = await getBacktest(
            instrumentId, start, end,
            "ema_cross",
            { fast: String(f), slow: String(s) },
            undefined,
            ctrl.signal
          );
          if (!ctrl.signal.aborted) {
            newResults[key] = getMetricValue(res, metric);
          }
        } catch (e) {
          if (!ctrl.signal.aborted) {
            newResults[key] = null;
          }
        }
        completed++;
        if (!ctrl.signal.aborted) {
          setProgress(completed);
          setResults({ ...newResults });
        }
      }
    }

    await Promise.all(Array.from({ length: 5 }, () => worker()));

    if (!ctrl.signal.aborted) {
      setRunning(false);
    }
  }

  function stopHeatmap() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const fastValues = rangeArr(fastMin, fastMax, fastStep);
  const slowValues = rangeArr(slowMin, slowMax, slowStep);

  // Compute min/max of non-null results for normalization
  const allValues = Object.values(results).filter((v): v is number => v !== null);
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;
  const invert = INVERT_METRIC.has(metric);

  const totalCombinations = fastValues.flatMap(f => slowValues.filter(s => f < s)).length;

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <PageBanner pageKey="heatmap" />
      {/* Header */}
      <div className="flex justify-end mb-2">
        <Link href="/backtest" className="text-text-3 hover:text-accent text-xs no-underline transition-colors">
          ← Backtest
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
        {/* Row 1: Instrument + Date */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Symbol</span>
          <InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
          <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Date</span>
          <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        </div>

        {/* Row 2: Fast EMA range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider w-24 shrink-0">Fast EMA</span>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Min
            <input type="number" value={fastMin} min={1} max={fastMax - 1}
              onChange={e => setFastMin(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"/>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Max
            <input type="number" value={fastMax} min={fastMin + 1}
              onChange={e => setFastMax(Math.max(fastMin + 1, parseInt(e.target.value) || fastMin + 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"/>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Step
            <input type="number" value={fastStep} min={1}
              onChange={e => setFastStep(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"/>
          </label>
          <span className="text-text-3 text-[10px] font-data">[{fastValues.join(", ")}]</span>
        </div>

        {/* Row 3: Slow EMA range */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider w-24 shrink-0">Slow EMA</span>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Min
            <input type="number" value={slowMin} min={2}
              onChange={e => setSlowMin(Math.max(2, parseInt(e.target.value) || 2))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"/>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Max
            <input type="number" value={slowMax} min={slowMin + 1}
              onChange={e => setSlowMax(Math.max(slowMin + 1, parseInt(e.target.value) || slowMin + 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"/>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-3">
            Step
            <input type="number" value={slowStep} min={1}
              onChange={e => setSlowStep(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-8 px-2 bg-panel-2 border border-border rounded text-text-1 font-data text-xs outline-none focus:border-accent"/>
          </label>
          <span className="text-text-3 text-[10px] font-data">[{slowValues.join(", ")}]</span>
        </div>

        {/* Row 4: Metric + Run */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">Metric</span>
          <SegmentedToggle
            value={metric}
            onChange={(m) => { setMetric(m); setResults({}); }}
            size="sm"
            options={(["sharpe", "sortino", "maxDrawdown", "winRate"] as HeatmapMetric[]).map(m => ({ value: m, label: METRIC_LABELS[m] }))}
          />
          <span className="text-text-3 text-[10px] font-data ml-auto">
            {totalCombinations} combinations
            {totalCombinations > 100 && <span className="text-warn ml-1">⚠ max 100</span>}
          </span>
          <Button variant="primary" size="md" onClick={running ? stopHeatmap : runHeatmap} disabled={totalCombinations === 0}>
            {running ? `Stop (${progress}/${total})` : "Run Heatmap"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Heatmap grid */}
      {Object.keys(results).length > 0 && (
        <Panel>
          <PanelHeader right={allValues.length > 0 ? (
            <span className="tabular-nums">
              min {formatValue(minVal, metric)} · max {formatValue(maxVal, metric)}
            </span>
          ) : undefined}>
            {METRIC_LABELS[metric]} — Fast EMA (rows) × Slow EMA (columns)
          </PanelHeader>
          <div className="p-4 overflow-x-auto">
            {/* Column headers (Slow EMA values) */}
            <div className="flex gap-0.5 mb-1 ml-9">
              {slowValues.map(s => (
                <div key={s} className="w-10 text-center text-[9px] text-text-3 font-data">{s}</div>
              ))}
            </div>

            {/* Grid rows */}
            <div className="space-y-0.5">
              {fastValues.map(f => (
                <div key={f} className="flex items-center gap-0.5">
                  {/* Row label (Fast EMA) */}
                  <span className="w-8 text-[9px] text-text-3 font-data text-right pr-1 shrink-0">{f}</span>
                  {/* Cells */}
                  {slowValues.map(s => {
                    const key = `${f}-${s}`;
                    const invalid = f >= s;
                    if (invalid) {
                      return (
                        <div
                          key={s}
                          className="w-10 h-8 bg-panel-2 rounded-sm opacity-20"title="Invalid: fast ≥ slow"/>
                      );
                    }
                    const value = results[key];
                    const hasResult = key in results;
                    const t = (hasResult && value !== null)
                      ? normalizeT(value, minVal, maxVal, invert)
                      : null;

                    return (
                      <div
                        key={s}
                        className="w-10 h-8 rounded-sm flex items-center justify-center cursor-default"// Accepted exception: visualization requires computed color
                        style={t !== null ? { backgroundColor: interpolateColor(t) } : undefined}
                        title={
                          !hasResult
                            ? `Fast=${f} Slow=${s}: not yet`
                            : value === null
                              ? `Fast=${f} Slow=${s}: error`
                              : `Fast=${f} Slow=${s}: ${formatValue(value, metric)}`
                        }
                      >
                        {!hasResult && running && (
                          <span className="text-[7px] text-text-3">…</span>
                        )}
                        {hasResult && value === null && (
                          <span className="text-[7px] text-neg">✗</span>
                        )}
                        {hasResult && value !== null && (
                          <span className="text-[8px] font-data text-white/90 drop-shadow">
                            {formatValue(value, metric)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-text-3 text-[9px]">{invert ? "Better ←" : "← Worse"}</span>
              <div className="flex h-3 w-40 rounded overflow-hidden">
                {Array.from({ length: 20 }, (_, i) => i / 19).map((t, i) => (
                  <div
                    key={i}
                    className="flex-1"// Accepted exception: gradient legend
                    style={{ backgroundColor: interpolateColor(t) }}
                  />
                ))}
              </div>
              <span className="text-text-3 text-[9px]">{invert ? "→ Worse" : "Better →"}</span>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
