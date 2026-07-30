"use client";

import type { Mode } from "@/lib/backtest-types";

interface StrategyModeTabsProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const TABS: { value: Mode; label: string }[] = [
  { value: "composite", label: "복합 / 조건부" },
  { value: "portfolio", label: "포트폴리오" },
];

export function StrategyModeTabs({ mode, onChange }: StrategyModeTabsProps) {
  return (
    <div className="inline-flex bg-panel-2 border border-border rounded-md p-0.5 gap-0.5">
      {TABS.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={[
            "px-4 py-1.5 text-sm rounded transition-all duration-150 cursor-pointer border-0",
            mode === tab.value
              ? "bg-panel text-accent font-medium border border-border shadow-sm": "bg-transparent text-text-3 hover:text-text-2",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
