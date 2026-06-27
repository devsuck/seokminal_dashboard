import Link from "next/link";

const METRICS = [
  { label: "Daily PnL" },
  { label: "Total Exposure" },
  { label: "Max Drawdown" },
  { label: "Portfolio Beta" },
  { label: "Open Positions" },
] as const;

export function PortfolioSnapshotWidget() {
  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full flex flex-col">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Portfolio Snapshot
      </span>

      <div className="space-y-2 flex-1">
        {METRICS.map(m => (
          <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">{m.label}</span>
            <span className="text-text-3 text-xs font-data">—</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-text-3 text-[10px] text-center">
          Portfolio tracking available in Phase 6
        </p>
        <Link
          href="/quant"
          className="block text-center text-xs text-accent hover:text-accent/80 transition-colors no-underline border border-accent/30 rounded-md py-2"
        >
          Open Portfolio Optimizer →
        </Link>
      </div>
    </div>
  );
}
