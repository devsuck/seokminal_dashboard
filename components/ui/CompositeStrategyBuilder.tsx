"use client";

import { newRule, buildSpawnRules, type SpawnRuleState } from "@/lib/backtest-types";
import { RuleCard } from "./RuleCard";
import { JsonPreview } from "./JsonPreview";

interface CompositeStrategyBuilderProps {
  rules: SpawnRuleState[];
  instrumentId: string;
  onChange: (rules: SpawnRuleState[]) => void;
}

export function CompositeStrategyBuilder({ rules, instrumentId, onChange }: CompositeStrategyBuilderProps) {
  function updRule(id: string, updated: SpawnRuleState) {
    onChange(rules.map(r => r.id === id ? updated : r));
  }
  function removeRule(id: string) {
    onChange(rules.filter(r => r.id !== id));
  }

  return (
    <div className="pt-2 border-t border-border">
      <div className="text-text-3 text-xs mb-4">
        Each rule = condition group (AND/OR) + strategy. Strategy fires when conditions are met. Empty conditions = always active.
      </div>

      {rules.map((r, i) => (
        <RuleCard
          key={r.id}
          rule={r}
          index={i}
          onChange={updated => updRule(r.id, updated)}
          onRemove={() => removeRule(r.id)}
        />
      ))}

      <button
        onClick={() => onChange([...rules, newRule()])}
        className="text-sm text-text-2 hover:text-text-1 border border-border hover:border-text-3 px-4 py-2 rounded-md cursor-pointer bg-transparent transition-colors"
      >
        + Add Rule
      </button>

      {rules.length > 0 && (
        <JsonPreview label="spawn_rules JSON preview" data={buildSpawnRules(rules, instrumentId)} />
      )}
    </div>
  );
}
