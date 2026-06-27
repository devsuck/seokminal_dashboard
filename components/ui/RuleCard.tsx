"use client";

import { newComp, type SpawnRuleState, type CompRow, type Combinator } from "@/lib/backtest-types";
import { ConditionRow } from "./ConditionRow";

interface RuleCardProps {
  rule: SpawnRuleState;
  index: number;
  onChange: (r: SpawnRuleState) => void;
  onRemove: () => void;
}

export function RuleCard({ rule, index, onChange, onRemove }: RuleCardProps) {
  const upd = (patch: Partial<SpawnRuleState>) => onChange({ ...rule, ...patch });

  function updComp(id: string, updated: CompRow) {
    upd({ comparisons: rule.comparisons.map(c => c.id === id ? updated : c) });
  }
  function removeComp(id: string) {
    upd({ comparisons: rule.comparisons.filter(c => c.id !== id) });
  }

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden mb-3">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-panel-2 border-b border-border">
        <span className="text-xs font-semibold text-text-3 uppercase tracking-wider">
          Rule {index + 1}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[11px]">Logic</span>
          <select
            className="compact"
            value={rule.combinator}
            onChange={e => upd({ combinator: e.target.value as Combinator })}
          >
            <option>AND</option>
            <option>OR</option>
          </select>
        </div>
        <button
          onClick={onRemove}
          className="ml-auto text-xs text-text-3 hover:text-neg border border-border hover:border-neg/40 px-2.5 py-1 rounded cursor-pointer bg-transparent transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Conditions */}
      <div className="px-4 pt-2 pb-0">
        <div className="text-text-3 text-[11px] uppercase tracking-wider mb-2">Conditions</div>
        {rule.comparisons.map((c, i) => (
          <div key={c.id} className="flex items-start gap-2">
            {/* AND/OR pill connector */}
            {i > 0 ? (
              <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 mt-2.5 shrink-0 w-8 text-center">
                {rule.combinator}
              </span>
            ) : (
              <span className="w-8 shrink-0" />
            )}
            <div className="flex-1">
              <ConditionRow
                row={c}
                onChange={r => updComp(c.id, r)}
                onRemove={() => removeComp(c.id)}
                isOnly={rule.comparisons.length === 1}
              />
            </div>
          </div>
        ))}
        <button
          onClick={() => upd({ comparisons: [...rule.comparisons, newComp()] })}
          className="text-xs text-text-3 hover:text-text-2 border border-border hover:border-border px-3 py-1.5 rounded cursor-pointer bg-transparent transition-colors my-3"
        >
          + Add Condition
        </button>
      </div>

      {/* Trigger footer */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-panel-2 border-t border-border">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Trigger</span>
        <span className="text-text-2 text-xs bg-panel border border-border px-2.5 py-1 rounded">
          EMA Cross
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[10px]">Fast</span>
          <input type="number" value={rule.fast} min={1} className="compact w-14"
            onChange={e => upd({ fast: Number(e.target.value) })} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-[10px]">Slow</span>
          <input type="number" value={rule.slow} min={1} className="compact w-14"
            onChange={e => upd({ slow: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}
