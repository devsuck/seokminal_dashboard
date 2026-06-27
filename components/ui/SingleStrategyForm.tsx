interface SingleStrategyFormProps {
  fast: number;
  slow: number;
  onFastChange: (v: number) => void;
  onSlowChange: (v: number) => void;
}

export function SingleStrategyForm({ fast, slow, onFastChange, onSlowChange }: SingleStrategyFormProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Strategy</span>
        <span className="text-text-2 text-xs bg-panel-2 border border-border px-3 py-1 rounded">
          EMA Cross
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Fast</span>
        <input
          type="number" value={fast} min={1}
          className="compact w-14"
          onChange={e => onFastChange(Number(e.target.value))}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Slow</span>
        <input
          type="number" value={slow} min={1}
          className="compact w-14"
          onChange={e => onSlowChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
