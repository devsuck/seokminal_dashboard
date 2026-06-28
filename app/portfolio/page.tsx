"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { updateWorkflow } from "@/lib/workflow-storage";
import {
  getPortfolioOptimize, getTimeSeries, ApiError,
  type PortfolioOptimizeResponse, type TimeSeriesPoint,
} from "@/lib/api";
import { computeAttribution, type AttributionInput, type PortfolioAttribution } from "@/lib/portfolio-utils";
import { EfficientFrontierChart } from "@/components/portfolio/EfficientFrontierChart";

type Tab = "optimizer" | "attribution";

interface WeightRow { id: string; instrumentId: string; weightStr: string; }

async function fetchAllTimeSeries(
  instrumentIds: string[],
  start: string,
  end: string,
  signal: AbortSignal,
  concurrency = 5,
): Promise<Record<string, TimeSeriesPoint[]>> {
  const result: Record<string, TimeSeriesPoint[]> = {};
  for (let i = 0; i < instrumentIds.length; i += concurrency) {
    const batch = instrumentIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async id => {
        const res = await getTimeSeries(id, start, end, undefined, undefined, signal);
        return { id, points: res.points };
      }),
    );
    for (const { id, points } of batchResults) result[id] = points;
  }
  return result;
}

function WeightBars({ weights }: { weights: Record<string, number> }) {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const maxW = Math.max(...entries.map(([, w]) => w), 0.001);
  return (
    <div className="space-y-1">
      {entries.map(([id, w]) => (
        <div key={id} className="flex items-center gap-2">
          <span className="text-text-3 text-xs font-data w-28 shrink-0 truncate">{id.split(".")[0]}</span>
          <div className="flex-1">
            <div className="h-4 rounded-sm bg-accent/40" style={{ width: `${(w / maxW) * 100}%` }} />
          </div>
          <span className="text-text-2 text-xs font-data w-12 text-right">{(w * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("optimizer");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState("2026-12-31");
  const optimizerAbortRef = useRef<AbortController | null>(null);
  const attrAbortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  // Optimizer state
  const [optimizerText, setOptimizerText] = useState(
    "005930.XKRX, 000660.XKRX, 035420.XKRX, 051910.XKRX"
  );
  const [optimizerResult, setOptimizerResult] = useState<PortfolioOptimizeResponse | null>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);

  // Attribution state
  const [weightRows, setWeightRows] = useState<WeightRow[]>([
    { id: crypto.randomUUID(), instrumentId: "005930.XKRX", weightStr: "40" },
    { id: crypto.randomUUID(), instrumentId: "000660.XKRX", weightStr: "30" },
    { id: crypto.randomUUID(), instrumentId: "035420.XKRX", weightStr: "30" },
  ]);
  const [attrResult, setAttrResult] = useState<PortfolioAttribution | null>(null);
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrError, setAttrError] = useState<string | null>(null);

  useEffect(() => () => {
    optimizerAbortRef.current?.abort();
    attrAbortRef.current?.abort();
  }, []);

  const runOptimizer = useCallback(async () => {
    const ids = optimizerText.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (ids.length < 2) { setOptimizerError("Enter at least 2 instruments"); return; }
    optimizerAbortRef.current?.abort();
    const ctrl = new AbortController();
    optimizerAbortRef.current = ctrl;
    setOptimizerLoading(true);
    setOptimizerError(null);
    setOptimizerResult(null);
    try {
      const res = await getPortfolioOptimize(ids, start, end, ctrl.signal);
      setOptimizerResult(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setOptimizerError(e instanceof ApiError ? e.message : "Failed to optimize portfolio");
    } finally {
      if (!ctrl.signal.aborted) setOptimizerLoading(false);
    }
  }, [optimizerText, start, end]);

  const runAttribution = useCallback(async () => {
    const parsedWeights = weightRows.map(r => ({
      instrumentId: r.instrumentId.trim(),
      weight: parseFloat(r.weightStr) / 100,
    })).filter(r => r.instrumentId);
    if (parsedWeights.some(r => isNaN(r.weight) || r.weight < 0)) {
      setAttrError("All weights must be non-negative numbers");
      return;
    }
    const totalWeight = parsedWeights.reduce((s, r) => s + r.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.005) {
      setAttrError(`Weights sum to ${(totalWeight * 100).toFixed(1)}% — must equal 100%`);
      return;
    }
    attrAbortRef.current?.abort();
    const ctrl = new AbortController();
    attrAbortRef.current = ctrl;
    setAttrLoading(true);
    setAttrError(null);
    setAttrResult(null);
    try {
      const seriesMap = await fetchAllTimeSeries(
        parsedWeights.map(r => r.instrumentId),
        start, end, ctrl.signal,
      );
      const result = computeAttribution(parsedWeights, seriesMap);
      setAttrResult(result);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAttrError(e instanceof ApiError ? e.message : "Failed to compute attribution");
    } finally {
      if (!ctrl.signal.aborted) setAttrLoading(false);
    }
  }, [weightRows, start, end]);

  const maxAbsContrib = useMemo(() => {
    if (!attrResult) return 0.001;
    return Math.max(...attrResult.instruments.map(i => Math.abs(i.contribution)), 0.001);
  }, [attrResult]);

  function handleWorkflowNext() {
    if (!optimizerResult) return;
    updateWorkflow({ portfolioWeights: optimizerResult.max_sharpe.weights });
    router.push("/bots");
  }

  function fmtPct(v: number): string {
    return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
  }

  function updateRow(i: number, field: keyof WeightRow, value: string) {
    setWeightRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setWeightRows(rows => [...rows, { id: crypto.randomUUID(), instrumentId: "", weightStr: "0" }]);
  }

  function removeRow(i: number) {
    setWeightRows(rows => rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="p-6 space-y-4 max-w-[1200px]">
      <div>
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">Portfolio Lab</h1>
        <p className="text-text-3 text-sm mt-0.5">
          Markowitz mean-variance optimization and performance attribution.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1">
        {(["optimizer", "attribution"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs rounded border cursor-pointer capitalize transition-colors ${
              tab === t ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2 bg-transparent"
            }`}>
            {t === "optimizer" ? "Optimizer" : "Attribution"}
          </button>
        ))}
      </div>

      {/* Shared date range */}
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

      {/* ── OPTIMIZER TAB ── */}
      {tab === "optimizer" && (
        <div className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Instruments (comma or newline)</label>
              <textarea rows={2} value={optimizerText} onChange={e => setOptimizerText(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent resize-none font-data" />
            </div>
            <button onClick={runOptimizer} disabled={optimizerLoading}
              className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {optimizerLoading ? "Optimizing…" : "Optimize"}
            </button>
          </div>

          {optimizerError && (
            <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{optimizerError}</div>
          )}

          {optimizerResult && (
            <>
              {/* Efficient frontier chart */}
              <div className="bg-bg border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Efficient Frontier</span>
                </div>
                <div className="p-4">
                  <EfficientFrontierChart
                    frontier={optimizerResult.efficient_frontier}
                    minVariance={optimizerResult.min_variance}
                    maxSharpe={optimizerResult.max_sharpe}
                  />
                </div>
              </div>

              {/* Weight tables side by side */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Min Variance", pw: optimizerResult.min_variance },
                  { label: "Max Sharpe", pw: optimizerResult.max_sharpe },
                ].map(({ label, pw }) => (
                  <div key={label} className="bg-panel border border-border rounded-lg p-4 space-y-3">
                    <div className="text-text-2 text-xs font-semibold">{label}</div>
                    <WeightBars weights={pw.weights} />
                    <div className="flex gap-4 text-xs pt-1 border-t border-border/40 flex-wrap">
                      <span className="text-text-3">Return: <span className={`font-data ${pw.expected_return >= 0 ? "text-pos" : "text-neg"}`}>{fmtPct(pw.expected_return)}</span></span>
                      <span className="text-text-3">Vol: <span className="font-data text-text-2">{(pw.volatility * 100).toFixed(2)}%</span></span>
                      {pw.sharpe !== null && pw.sharpe !== undefined && (
                        <span className="text-text-3">Sharpe: <span className="font-data text-text-2">{pw.sharpe.toFixed(2)}</span></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!optimizerResult && !optimizerLoading && !optimizerError && (
            <div className="text-center py-12 text-text-3 text-sm">
              Enter instruments and click Optimize to compute the efficient frontier.
            </div>
          )}
        </div>
      )}

      {/* ── ATTRIBUTION TAB ── */}
      {tab === "attribution" && (
        <div className="space-y-4">
          <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1">
              <label className="text-text-3 text-[11px] uppercase tracking-wider">Instrument Weights</label>
              <div className="space-y-1.5">
                {weightRows.map((row, i) => (
                  <div key={row.id} className="flex gap-2 items-center">
                    <input
                      value={row.instrumentId}
                      onChange={e => updateRow(i, "instrumentId", e.target.value)}
                      placeholder="005930.XKRX"
                      className="h-8 flex-1 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent font-data"
                    />
                    <input
                      type="number"
                      value={row.weightStr}
                      onChange={e => updateRow(i, "weightStr", e.target.value)}
                      className="h-8 w-20 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 outline-none focus:border-accent font-data text-right"
                    />
                    <span className="text-text-3 text-xs">%</span>
                    <button onClick={() => removeRow(i)}
                      className="text-text-3 hover:text-neg text-sm cursor-pointer bg-transparent border-0 px-1">
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addRow}
                className="text-xs text-text-3 hover:text-text-2 border border-border rounded px-3 py-1 cursor-pointer bg-transparent mt-1">
                + Add
              </button>
            </div>
            <button onClick={runAttribution} disabled={attrLoading}
              className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
              {attrLoading ? "Computing…" : "Run"}
            </button>
          </div>

          {attrError && (
            <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{attrError}</div>
          )}

          {attrResult && (
            <>
              {/* Portfolio total return */}
              <div className="bg-panel border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                <span className="text-text-3 text-xs uppercase tracking-wider">Portfolio Return</span>
                <span className={`text-lg font-data font-semibold ${attrResult.portfolioReturn >= 0 ? "text-pos" : "text-neg"}`}>
                  {fmtPct(attrResult.portfolioReturn)}
                </span>
              </div>

              {/* Attribution bar chart */}
              <div className="bg-panel border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                  <span className="text-text-3 text-[11px] uppercase tracking-wider">Return Attribution</span>
                </div>
                <div className="px-4 py-3 space-y-0.5">
                  {/* Header */}
                  <div className="flex items-center gap-2 pb-1 border-b border-border/40 mb-1">
                    <span className="text-text-3 text-[10px] uppercase w-28 shrink-0">Instrument</span>
                    <span className="flex-1 text-text-3 text-[10px] uppercase">Contribution</span>
                    <span className="text-text-3 text-[10px] uppercase w-20 text-right">Contrib</span>
                    <span className="text-text-3 text-[10px] uppercase w-16 text-right">Weight</span>
                    <span className="text-text-3 text-[10px] uppercase w-20 text-right">Total Ret</span>
                  </div>
                  {attrResult.instruments.map(inst => {
                    const pct = (Math.abs(inst.contribution) / maxAbsContrib) * 100;
                    const isPos = inst.contribution >= 0;
                    return (
                      <div key={inst.instrumentId} className="flex items-center gap-2 py-0.5">
                        <span className="text-text-3 font-data text-xs w-28 shrink-0 truncate">
                          {inst.instrumentId.split(".")[0]}
                        </span>
                        <div className="flex-1">
                          <div
                            className={`h-4 rounded-sm ${isPos ? "bg-pos/50" : "bg-neg/50"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-data w-20 text-right ${isPos ? "text-pos" : "text-neg"}`}>
                          {fmtPct(inst.contribution)}
                        </span>
                        <span className="text-text-3 text-xs font-data w-16 text-right">
                          {(inst.weight * 100).toFixed(0)}%
                        </span>
                        <span className={`text-xs font-data w-20 text-right ${inst.totalReturn >= 0 ? "text-pos" : "text-neg"}`}>
                          {fmtPct(inst.totalReturn)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!attrResult && !attrLoading && !attrError && (
            <div className="text-center py-12 text-text-3 text-sm">
              Set instrument weights (must sum to 100%) and click Run to compute attribution.
            </div>
          )}
        </div>
      )}

      {optimizerResult !== null && tab === "optimizer" && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-text-3 text-[10px] uppercase tracking-wider">Workflow</div>
            <p className="text-text-1 text-sm font-medium mt-0.5">Portfolio optimised — deploy a bot with the Max-Sharpe weights</p>
          </div>
          <button
            onClick={handleWorkflowNext}
            className="px-4 py-1.5 text-xs font-semibold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0 whitespace-nowrap flex-shrink-0"
          >
            → Deploy Bot
          </button>
        </div>
      )}
    </div>
  );
}
