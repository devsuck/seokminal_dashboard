"use client";

import { useState } from "react";
import { newRule, buildSpawnRules, ruleFromNlResult, type SpawnRuleState } from "@/lib/backtest-types";
import { nlToCondition } from "@/lib/api";
import { RuleCard } from "./RuleCard";
import { JsonPreview } from "./JsonPreview";

interface CompositeStrategyBuilderProps {
  rules: SpawnRuleState[];
  instrumentId: string;
  onChange: (rules: SpawnRuleState[]) => void;
}

export function CompositeStrategyBuilder({ rules, instrumentId, onChange }: CompositeStrategyBuilderProps) {
  const [nlText, setNlText] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);

  function updRule(id: string, updated: SpawnRuleState) {
    onChange(rules.map(r => r.id === id ? updated : r));
  }
  function removeRule(id: string) {
    onChange(rules.filter(r => r.id !== id));
  }

  async function handleNlConvert() {
    if (!nlText.trim() || nlLoading) return;
    setNlLoading(true);
    setNlError(null);
    try {
      const result = await nlToCondition(nlText.trim());
      onChange([...rules, ruleFromNlResult(result)]);
      setNlText("");
    } catch (e) {
      setNlError(e instanceof Error ? e.message : "조건식 변환 실패");
    } finally {
      setNlLoading(false);
    }
  }

  return (
    <div className="pt-2 border-t border-border">
      <div className="text-text-3 text-xs mb-4">
        Each rule = condition group (AND/OR) + strategy. Strategy fires when conditions are met. Empty conditions = always active.
      </div>

      <div className="mb-4 p-3 rounded-md border border-border bg-panel-2">
        <div className="text-text-2 text-xs mb-2">자연어 → 조건식 (AI 변환, 결과는 편집 가능한 Rule로 추가됨)</div>
        <textarea
          value={nlText}
          onChange={e => setNlText(e.target.value)}
          placeholder="예: RSI가 30 밑으로 떨어지면 매수, EMA는 5/15로"
          rows={2}
          className="w-full text-sm bg-panel border border-border rounded-md px-3 py-2 text-text-1 placeholder:text-text-3 resize-none"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleNlConvert}
            disabled={nlLoading || !nlText.trim()}
            className="text-sm text-text-2 hover:text-text-1 border border-border hover:border-text-3 px-4 py-1.5 rounded-md cursor-pointer bg-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {nlLoading ? "변환 중..." : "조건식으로 변환"}
          </button>
          {nlError && <span className="text-neg text-xs">{nlError}</span>}
        </div>
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
        className="text-sm text-text-2 hover:text-text-1 border border-border hover:border-text-3 px-4 py-2 rounded-md cursor-pointer bg-transparent transition-colors">
        + Add Rule
      </button>

      {rules.length > 0 && (
        <JsonPreview label="spawn_rules JSON preview" data={buildSpawnRules(rules, instrumentId)} />
      )}
    </div>
  );
}
