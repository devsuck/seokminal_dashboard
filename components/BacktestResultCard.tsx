import type { BacktestResponse } from "@/lib/api";

interface BacktestResultCardProps {
  result: BacktestResponse;
}

function color(v: number | null, invert = false) {
  if (v == null) return "#888";
  if (invert) return v < 0 ? "#00cc44" : "#ff3333";
  return v >= 0 ? "#00cc44" : "#ff3333";
}

export function BacktestResultCard({ result }: BacktestResultCardProps) {
  const rows = [
    { label: "SHARPE RATIO",  value: result.sharpe_ratio?.toFixed(4) ?? "N/A",   col: color(result.sharpe_ratio) },
    { label: "MAX DRAWDOWN",  value: result.max_drawdown != null ? (result.max_drawdown * 100).toFixed(2) + "%" : "N/A", col: color(result.max_drawdown, true) },
    { label: "TOTAL PNL",     value: result.total_pnl?.toFixed(2) ?? "N/A",      col: color(result.total_pnl) },
    { label: "TOTAL PNL %",   value: result.total_pnl_pct != null ? (result.total_pnl_pct * 100).toFixed(2) + "%" : "N/A", col: color(result.total_pnl_pct) },
    { label: "BAR COUNT",     value: String(result.bar_count),                    col: "#e8e8e8" },
  ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", maxWidth: 480, marginTop: 12 }}>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} style={{ borderBottom: "1px solid #1e1e1e" }}>
            <td style={{ padding: "7px 14px 7px 0", color: "#ff8c00", fontSize: 13, width: 180 }}>{r.label}</td>
            <td style={{ padding: "7px 0", color: r.col, fontWeight: "bold", fontSize: 15, fontFamily: "monospace" }}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
