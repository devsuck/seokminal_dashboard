"use client";

import type { Experiment, ExperimentMetrics } from "@/lib/experiment-storage";

interface ExperimentCompareProps {
  experiments: [Experiment, Experiment];
  onClose: () => void;
}

interface MetricRow {
  label: string;
  key: keyof ExperimentMetrics;
  format: (v: number | null) => string;
  higherBetter: boolean | null; // null = neutral
}

const METRIC_ROWS: MetricRow[] = [
  {
    label: "Sharpe Ratio",
    key: "sharpe",
    format: v => v?.toFixed(2) ?? "—",
    higherBetter: true,
  },
  {
    label: "Sortino Ratio",
    key: "sortino",
    format: v => v?.toFixed(2) ?? "—",
    higherBetter: true,
  },
  {
    label: "Max Drawdown",
    key: "maxDrawdown",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: false,
  },
  {
    label: "Win Rate",
    key: "winRate",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: true,
  },
  {
    label: "Total Return",
    key: "totalPnlPct",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: true,
  },
  {
    label: "Total Trades",
    key: "totalTrades",
    format: v => String(v ?? "—"),
    higherBetter: null,
  },
  {
    label: "Volatility",
    key: "volatility",
    format: v => v != null ? `${(v * 100).toFixed(1)}%` : "—",
    higherBetter: false,
  },
];

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return b - a;
}

function deltaClass(d: number | null, higherBetter: boolean | null): string {
  if (d == null || higherBetter == null || d === 0) return "text-text-3";
  const better = higherBetter ? d > 0 : d < 0;
  return better ? "text-pos" : "text-neg";
}

function deltaLabel(d: number | null, row: MetricRow): string {
  if (d == null) return "—";
  const sign = d > 0 ? "+" : "";
  if (row.key === "totalTrades") return `${sign}${d.toFixed(0)}`;
  if (row.key === "maxDrawdown" || row.key === "winRate" || row.key === "totalPnlPct" || row.key === "volatility") {
    return `${sign}${(d * 100).toFixed(1)}pp`;
  }
  return `${sign}${d.toFixed(2)}`;
}

export function ExperimentCompare({ experiments, onClose }: ExperimentCompareProps) {
  const [a, b] = experiments;

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Experiment Comparison</span>
        <button
          onClick={onClose}
          className="text-text-3 hover:text-text-1 text-xs bg-transparent border-0 cursor-pointer transition-colors"
        >
          Close ×
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider w-32">Metric</th>
              <th className="px-4 py-3 text-right">
                <div className="text-text-1 font-medium truncate max-w-[220px] text-right">{a.label}</div>
                <div className="text-text-3 text-[9px] font-data mt-0.5">{a.params.start} – {a.params.end}</div>
              </th>
              <th className="px-4 py-3 text-right">
                <div className="text-text-1 font-medium truncate max-w-[220px] text-right">{b.label}</div>
                <div className="text-text-3 text-[9px] font-data mt-0.5">{b.params.start} – {b.params.end}</div>
              </th>
              <th className="px-4 py-3 text-right text-text-3 font-normal text-[10px] uppercase tracking-wider">
                Δ (B − A)
              </th>
            </tr>
          </thead>
          <tbody>
            {METRIC_ROWS.map(row => {
              const va = a.metrics[row.key] as number | null;
              const vb = b.metrics[row.key] as number | null;
              const d = delta(va, vb);
              return (
                <tr key={row.key} className="border-b border-border/40 hover:bg-panel-2/30">
                  <td className="px-4 py-2.5 text-text-3">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-data text-text-2">{row.format(va)}</td>
                  <td className="px-4 py-2.5 text-right font-data text-text-2">{row.format(vb)}</td>
                  <td className={`px-4 py-2.5 text-right font-data ${deltaClass(d, row.higherBetter)}`}>
                    {deltaLabel(d, row)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Params comparison */}
      <div className="px-4 py-3 border-t border-border grid grid-cols-2 gap-4">
        {[a, b].map(exp => (
          <div key={exp.id} className="space-y-1">
            <p className="text-text-3 text-[10px] uppercase tracking-wider">{exp.label}</p>
            <p className="text-text-2 text-[11px] font-data">
              {exp.params.instrumentId} · {exp.params.timeframe} · {exp.params.start} – {exp.params.end}
            </p>
            {exp.params.strategy === "ema_cross" && (
              <p className="text-text-3 text-[10px] font-data">EMA {exp.params.fast}/{exp.params.slow}</p>
            )}
            {exp.params.strategy === "gated" && (
              <p className="text-text-3 text-[10px] font-data">Gated · {exp.params.rulesCount} rules</p>
            )}
            {exp.notes && (
              <p className="text-text-3 text-[10px] italic">"{exp.notes}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
