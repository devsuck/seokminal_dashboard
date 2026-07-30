"use client";

import { Panel } from "@/components/console/primitives";
import { formatValue, signTone, toneColor, type NumberFormat, type Tone } from "./tokens";

// 수익률/변동성/샤프/드로다운/익스포저 전용 스탯 타일. console/primitives.tsx 의 StatTile과
// 목적이 겹치지만, "큰 숫자일수록 위계가 강해야 한다"는 감사 지적(§2.1)을 반영해
// size 단계(sm/md/lg/hero)를 명시적으로 노출한 변형. Panel을 그대로 재사용해 시각 언어는 통일.

// hero(30px)는 넓은 값(7자리 통화 등)을 담기엔 표준 1-col 타일 폭이 부족할 수 있음 —
// 그리드에서 col-span 2 이상으로 배치할 것(app/(console)/design-system 예시 참고).
const SIZE: Record<"sm" | "md" | "lg" | "hero", string> = {
  sm: "text-[15px]",
  md: "text-[20px]",
  lg: "text-[26px]",
  hero: "text-[30px]",
};

export interface FinancialMetricProps {
  label: string;
  value: number | string;
  format?: NumberFormat;
  precision?: number;
  size?: "sm" | "md" | "lg" | "hero";
  signColor?: boolean;
  unit?: string;
  delta?: { value: number; format?: NumberFormat };
  tone?: Tone;
  className?: string;
}

export function FinancialMetric({
  label,
  value,
  format = "number",
  precision = 2,
  size = "md",
  signColor = false,
  unit,
  delta,
  tone,
  className = "",
}: FinancialMetricProps) {
  const numeric = typeof value === "number" ? value : undefined;
  const resolvedTone: Tone = tone ?? (signColor && numeric !== undefined ? signTone(numeric) : "hud");
  const color = resolvedTone === "hud" ? "var(--c-text-1)" : toneColor(resolvedTone);

  return (
    <Panel className={`relative p-4 overflow-hidden ${className}`}>
      <div className="text-[9.5px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`c-num leading-none font-semibold ${SIZE[size]}`} style={{ color }}>
          {formatValue(value, format, precision)}
        </span>
        {unit && <span className="text-[11px] text-[var(--c-text-2)]">{unit}</span>}
      </div>
      {delta && (
        <div
          className="mt-1.5 text-[11px] c-num font-medium"
          style={{ color: toneColor(signTone(delta.value)) }}
        >
          {formatValue(delta.value, delta.format ?? "percent", 1)}
        </div>
      )}
    </Panel>
  );
}
