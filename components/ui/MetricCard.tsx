interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  colorClass?: string; // e.g. "text-pos", "text-neg", "text-text-1"
}

export function MetricCard({ label, value, delta, colorClass = "text-text-1" }: MetricCardProps) {
  return (
    <div className="bg-panel border border-border rounded-md px-4 py-3 min-w-[90px]">
      <div className="text-text-3 text-[11px] uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`font-data text-[17px] font-semibold leading-none ${colorClass}`}>{value}</div>
      {delta && (
        <div className={`font-data text-xs mt-1 ${colorClass}`}>{delta}</div>
      )}
    </div>
  );
}
