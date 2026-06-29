"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getBacktestResults,
  deleteBacktestResult,
  type SavedBacktestResult,
} from "@/lib/backtest-result-storage";
import { RollingChart, type RollingSeries } from "@/components/rolling/RollingChart";
import type { TradeRecord } from "@/lib/api";

const SERIES_COLORS = ["#FF9F1C", "#60A5FA", "#34D399", "#F472B6"] as const;
const MAX_SELECTED = 4;

function tradesToCumPnl(
  trades: TradeRecord[]
): { ts_ns: number; value: number | null }[] {
  const closed = trades
    .filter(
      (t): t is TradeRecord & { exit_ts_ns: number; pnl: number } =>
        t.exit_ts_ns !== null && t.pnl !== null
    )
    .sort((a, b) => a.exit_ts_ns - b.exit_ts_ns);
  let cum = 0;
  return closed.map(t => {
    cum += t.pnl;
    return { ts_ns: t.exit_ts_ns, value: cum };
  });
}

interface MetricDef {
  label: string;
  get: (r: SavedBacktestResult) => number | null;
  fmt: (v: number | null) => string;
  higherBetter: boolean | null;
}

const METRICS: MetricDef[] = [
  {
    label: "Sharpe Ratio",
    get: r => r.result.sharpe_ratio,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: true,
  },
  {
    label: "Sortino Ratio",
    get: r => r.result.sortino_ratio,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: true,
  },
  {
    label: "Max Drawdown",
    get: r => r.result.max_drawdown,
    fmt: v => (v != null ? `${(v * 100).toFixed(2)}%` : "—"),
    higherBetter: true,
  },
  {
    label: "Win Rate",
    get: r => r.result.win_rate,
    fmt: v => (v != null ? `${(v * 100).toFixed(1)}%` : "—"),
    higherBetter: true,
  },
  {
    label: "Total PnL %",
    get: r => r.result.total_pnl_pct,
    fmt: v => (v != null ? `${(v * 100).toFixed(2)}%` : "—"),
    higherBetter: true,
  },
  {
    label: "Volatility",
    get: r => r.result.volatility,
    fmt: v => (v != null ? `${(v * 100).toFixed(2)}%` : "—"),
    higherBetter: false,
  },
  {
    label: "P/L Ratio",
    get: r => r.result.profit_loss_ratio,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: true,
  },
  {
    label: "Beta",
    get: r => r.result.beta,
    fmt: v => v?.toFixed(3) ?? "—",
    higherBetter: null,
  },
  {
    label: "Trade Count",
    get: r => r.result.trades.length,
    fmt: v => (v != null ? String(v) : "—"),
    higherBetter: null,
  },
];

function cellColorClass(
  value: number | null,
  values: (number | null)[],
  higherBetter: boolean | null
): string {
  if (higherBetter === null || value === null) return "text-text-2";
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return "text-text-2";
  const best = higherBetter ? Math.max(...valid) : Math.min(...valid);
  const worst = higherBetter ? Math.min(...valid) : Math.max(...valid);
  if (value === best) return "text-pos";
  if (value === worst && best !== worst) return "text-neg";
  return "text-text-2";
}

export default function BacktestComparePage() {
  const [results, setResults] = useState<SavedBacktestResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setResults(getBacktestResults());
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTED) {
        next.add(id);
      }
      return next;
    });
  }

  function handleDelete(id: string) {
    deleteBacktestResult(id);
    setResults(prev => prev.filter(r => r.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const selected = results.filter(r => selectedIds.has(r.id));

  const cumPnlSeries: RollingSeries[] = selected.map((r, i) => ({
    label: r.label,
    color: SERIES_COLORS[i],
    points: tradesToCumPnl(r.result.trades),
  }));

  const hasPnlData = cumPnlSeries.some(s => s.points.length > 0);

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-text-1 text-2xl font-semibold">Compare Results</h1>
        <Link
          href="/backtest"
          className="text-text-3 hover:text-accent text-sm transition-colors no-underline"
        >
          ← Backtest
        </Link>
      </div>

      {results.length === 0 ? (
        <div className="bg-panel border border-border rounded-lg p-8 text-center">
          <p className="text-text-3 text-sm mb-2">No saved results yet.</p>
          <Link
            href="/backtest"
            className="text-accent text-sm no-underline hover:brightness-110"
          >
            Run a backtest and save the result →
          </Link>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Left sidebar: result list */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                <span className="text-text-3 text-[11px] uppercase tracking-wider">
                  Saved Results ({results.length})
                </span>
              </div>
              <div className="divide-y divide-border">
                {results.map(r => {
                  const selIdx = selected.indexOf(r);
                  const isSelected = selIdx >= 0;
                  return (
                    <div key={r.id} className="px-3 py-2.5 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelected && selectedIds.size >= MAX_SELECTED}
                        onChange={() => toggleSelect(r.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block"
                              style={{ backgroundColor: SERIES_COLORS[selIdx] }}
                            />
                          )}
                          <span className="text-text-1 text-xs font-medium truncate">
                            {r.label}
                          </span>
                        </div>
                        <span className="text-text-3 text-[11px]">
                          {r.instrumentId} · {r.start}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-text-3 hover:text-neg text-xs transition-colors flex-shrink-0"
                        aria-label={`Delete ${r.label}`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {selectedIds.size >= MAX_SELECTED && (
              <p className="text-text-3 text-xs mt-2 px-1">
                Max {MAX_SELECTED} results selected
              </p>
            )}
          </div>

          {/* Right: comparison content */}
          <div className="flex-1 space-y-4 min-w-0">
            {selected.length === 0 ? (
              <div className="bg-panel border border-border rounded-lg p-6 text-center">
                <p className="text-text-3 text-sm">
                  Select results from the list to compare.
                </p>
              </div>
            ) : (
              <>
                {/* Metrics comparison table */}
                <div className="bg-panel border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-panel-2">
                    <span className="text-text-3 text-[11px] uppercase tracking-wider">
                      Metrics
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2.5 text-left text-text-3 font-medium w-36">
                            Metric
                          </th>
                          {selected.map((r, i) => (
                            <th
                              key={r.id}
                              className="px-4 py-2.5 text-right text-text-2 font-medium"
                            >
                              <span className="flex items-center justify-end gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                  style={{ backgroundColor: SERIES_COLORS[i] }}
                                />
                                <span className="truncate max-w-[120px]">{r.label}</span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {METRICS.map(metric => {
                          const vals = selected.map(r => metric.get(r));
                          return (
                            <tr
                              key={metric.label}
                              className="hover:bg-panel-2 transition-colors"
                            >
                              <td className="px-4 py-2 text-text-3">{metric.label}</td>
                              {vals.map((v, i) => (
                                <td
                                  key={selected[i].id}
                                  className={`px-4 py-2 text-right ${cellColorClass(v, vals, metric.higherBetter)}`}
                                >
                                  {metric.fmt(v)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Cumulative PnL chart */}
                {hasPnlData && (
                  <div className="bg-panel border border-border rounded-lg p-4">
                    <div className="px-0 pb-3">
                      <span className="text-text-3 text-[11px] uppercase tracking-wider">
                        Cumulative PnL
                      </span>
                    </div>
                    <div className="flex gap-4 mb-3 flex-wrap">
                      {selected.map((r, i) => (
                        <span key={r.id} className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-0.5 rounded inline-block"
                            style={{ backgroundColor: SERIES_COLORS[i] }}
                          />
                          <span className="text-text-2 text-xs">{r.label}</span>
                        </span>
                      ))}
                    </div>
                    <RollingChart
                      series={cumPnlSeries}
                      height={260}
                      yFormat={v => v.toFixed(0)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
