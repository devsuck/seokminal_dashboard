import type { BacktestResponse } from "@/lib/api";

interface BacktestResultCardProps {
  result: BacktestResponse;
}

const METRICS: { key: keyof BacktestResponse; label: string }[] = [
  { key: "sharpe_ratio", label: "Sharpe Ratio" },
  { key: "max_drawdown", label: "Max Drawdown" },
  { key: "total_pnl", label: "Total PnL" },
  { key: "total_pnl_pct", label: "Total PnL %" },
  { key: "bar_count", label: "Bar Count" },
];

export function BacktestResultCard({ result }: BacktestResultCardProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      {METRICS.map(({ key, label }) => (
        <div key={key} className="border border-gray-300 rounded p-4">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-semibold">
            {result[key] === null ? "N/A" : result[key]}
          </p>
        </div>
      ))}
    </div>
  );
}
