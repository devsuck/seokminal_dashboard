"use client";

import type { ReactNode } from "react";
import type { Strategy, StrategyParams, EmaParams } from "@/lib/strategy-storage";

interface StrategyCompareProps {
  strategies: [Strategy, Strategy];
  onClose: () => void;
}

function renderParams(params: StrategyParams): ReactNode {
  if (params.type === "ema_cross") {
    return (
      <div className="space-y-1 text-xs font-data">
        <div className="flex justify-between"><span className="text-text-3">Type</span><span className="text-text-2">EMA Cross</span></div>
        <div className="flex justify-between"><span className="text-text-3">Fast EMA</span><span className="text-text-2">{params.fast}</span></div>
        <div className="flex justify-between"><span className="text-text-3">Slow EMA</span><span className="text-text-2">{params.slow}</span></div>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-xs font-data">
      <div className="flex justify-between"><span className="text-text-3">Type</span><span className="text-text-2">Gated</span></div>
      <div className="flex justify-between"><span className="text-text-3">Rules</span><span className="text-text-2">{params.rules.length}</span></div>
      {params.rules.map((r, i) => (
        <div key={r.id} className="flex justify-between pl-2">
          <span className="text-text-3">Rule {i + 1} EMA</span>
          <span className="text-text-2">{r.fast}/{r.slow} ({r.combinator})</span>
        </div>
      ))}
    </div>
  );
}

function diffClass(a: number, b: number, higherBetter = true): string {
  if (a === b) return "text-text-3";
  return (higherBetter ? b > a : b < a) ? "text-pos" : "text-neg";
}

export function StrategyCompare({ strategies, onClose }: StrategyCompareProps) {
  const [a, b] = strategies;
  const bothEma = a.params.type === "ema_cross" && b.params.type === "ema_cross";

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center justify-between">
        <span className="text-text-3 text-[11px] uppercase tracking-wider">Strategy Comparison</span>
        <button
          onClick={onClose}
          className="text-text-3 hover:text-text-1 text-xs bg-transparent border-0 cursor-pointer transition-colors">
          Close ×
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border p-4 gap-4">
        {[a, b].map((s) => (
          <div key={s.id} className="space-y-3">
            <div>
              <div className="text-text-1 font-medium text-sm">{s.name}</div>
              <div className="text-text-3 text-[10px] mt-0.5">{s.description || "No description"}</div>
            </div>
            {renderParams(s.params)}
            <div className="text-text-3 text-[9px]">
              {s.versions.length} version{s.versions.length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Numeric diff for EMA cross */}
      {bothEma && (() => {
        const ap = a.params as EmaParams;
        const bp = b.params as EmaParams;
        return (
          <div className="px-4 pb-4 border-t border-border/40 pt-3">
            <span className="text-text-3 text-[10px] uppercase tracking-wider">Delta (B − A)</span>
            <div className="flex gap-6 mt-2 text-xs font-data">
              <span>Fast: <span className={diffClass(ap.fast, bp.fast, false)}>{bp.fast - ap.fast >= 0 ? "+" : ""}{bp.fast - ap.fast}</span></span>
              <span>Slow: <span className={diffClass(ap.slow, bp.slow, false)}>{bp.slow - ap.slow >= 0 ? "+" : ""}{bp.slow - ap.slow}</span></span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
