"use client";

import { SCENARIOS } from "@/lib/scenario-presets";

interface ScenarioSelectProps {
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

export function ScenarioSelect({ onStartChange, onEndChange }: ScenarioSelectProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;
    const scenario = SCENARIOS.find(s => s.id === id);
    if (!scenario) return;
    onStartChange(scenario.start);
    onEndChange(scenario.end);
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">시나리오</span>
      <select
        defaultValue=""onChange={handleChange}
        className="h-9 px-2 text-xs bg-panel-2 border border-border rounded-md text-text-2 outline-none focus:border-accent cursor-pointer">
        <option value="" disabled>위기 시나리오 선택…</option>
        {SCENARIOS.map(s => (
          <option key={s.id} value={s.id} title={s.description}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
