import { MetricCard } from "./MetricCard";
import type { BacktestResponse } from "@/lib/api";
import { pnlClass } from "@/lib/backtest-types";

interface MetricGridProps {
  result: BacktestResponse | null;
}

function fmt(v: number | null | undefined, fn: (n: number) => string): string {
  return v == null ? "—" : fn(v);
}

export function MetricGrid({ result }: MetricGridProps) {
  const metrics = [
    {
      label: "Total PnL",
      value: fmt(result?.total_pnl, n => (n >= 0 ? "+" : "") + n.toFixed(2)),
      delta: fmt(result?.total_pnl_pct, n => (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%"),
      colorClass: pnlClass(result?.total_pnl),
    },
    {
      label: "Sharpe",
      value: fmt(result?.sharpe_ratio, n => n.toFixed(3)),
      colorClass: pnlClass(result?.sharpe_ratio),
    },
    {
      label: "Sortino",
      value: fmt(result?.sortino_ratio, n => n.toFixed(3)),
      colorClass: pnlClass(result?.sortino_ratio),
    },
    {
      label: "Volatility",
      value: fmt(result?.volatility, n => (n * 100).toFixed(2) + "%"),
      colorClass: "text-text-1",
    },
    {
      label: "Max DD",
      value: result?.max_drawdown != null
        ? (result.max_drawdown * 100).toFixed(2) + "%": "—",
      colorClass: result?.max_drawdown != null ? "text-neg" : "text-text-3",
    },
    {
      label: "Beta",
      value: fmt(result?.beta, n => n.toFixed(3)),
      colorClass: result?.beta != null ? "text-text-1" : "text-text-3",
    },
    {
      label: "Win Rate",
      value: fmt(result?.win_rate, n => (n * 100).toFixed(1) + "%"),
      colorClass: pnlClass(result?.win_rate ? result.win_rate - 0.5 : null),
    },
    {
      label: "P/L Ratio",
      value: fmt(result?.profit_loss_ratio, n => n.toFixed(2)),
      colorClass: pnlClass(result?.profit_loss_ratio ? result.profit_loss_ratio - 1 : null),
    },
    {
      label: "Avg Win",
      value: fmt(result?.avg_win, n => n.toFixed(2)),
      colorClass: "text-pos",
    },
    {
      label: "Avg Loss",
      value: fmt(result?.avg_loss, n => n.toFixed(2)),
      colorClass: "text-neg",
    },
    {
      label: "Trades",
      value: result ? String(result.trades.length) : "—",
      colorClass: "text-text-1",
    },
    {
      label: "Bars",
      value: result ? String(result.bar_count) : "—",
      colorClass: "text-text-3",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 p-4">
      {metrics.map(m => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          delta={m.delta}
          colorClass={m.colorClass}
        />
      ))}
    </div>
  );
}
