"use client";

import type { ReactNode } from "react";
import { toneColor, type Tone } from "./tokens";

// 전역 상태 스트립 — market status / regime / exposure / risk state / system health.
// 페이지 타이틀바(console/widgets.tsx 의 PageHeader)와는 역할이 다름: 이건 어느 페이지에서든
// "지금 무엇을 봐야 하는가"를 놓치지 않게 하는 상시 노출용 컴포넌트. 데이터는 props로만 받음(자체 fetch 없음).

export interface SystemHealthItem {
  label: string;
  status: "online" | "degraded" | "offline";
}

export interface TerminalHeaderProps {
  marketStatus: { label: string; tone?: Tone };
  regime: { label: string; tone?: Tone };
  exposure: { value: number; unit?: string };
  riskState: { label: string; tone?: Tone };
  systemHealth: SystemHealthItem[];
  right?: ReactNode;
  className?: string;
}

const HEALTH_TONE: Record<SystemHealthItem["status"], Tone> = {
  online: "pos",
  degraded: "warn",
  offline: "neg",
};

function Segment({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 first:pl-0 border-l border-[var(--c-border)] first:border-l-0 h-full">
      <span className="text-[9px] font-semibold tracking-[0.18em] text-[var(--c-text-3)] uppercase shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Pip({ tone = "mute", children }: { tone?: Tone; children: ReactNode }) {
  const c = toneColor(tone);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold c-num" style={{ color: c }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
      {children}
    </span>
  );
}

export function TerminalHeader({
  marketStatus,
  regime,
  exposure,
  riskState,
  systemHealth,
  right,
  className = "",
}: TerminalHeaderProps) {
  const healthDown = systemHealth.filter((s) => s.status !== "online");
  return (
    <div
      className={`flex items-center justify-between gap-4 h-9 px-4 border-b border-[var(--c-border)] bg-[var(--c-panel)] text-[11px] ${className}`}
    >
      <div className="flex items-center h-full min-w-0 overflow-x-auto">
        <Segment label="시장">
          <Pip tone={marketStatus.tone ?? "pos"}>{marketStatus.label}</Pip>
        </Segment>
        <Segment label="국면">
          <Pip tone={regime.tone ?? "info"}>{regime.label}</Pip>
        </Segment>
        <Segment label="익스포저">
          <span className="c-num text-[var(--c-text-1)] font-semibold">
            {exposure.value >= 0 ? "+" : ""}
            {exposure.value.toFixed(1)}
            {exposure.unit ?? "%"}
          </span>
        </Segment>
        <Segment label="리스크">
          <Pip tone={riskState.tone ?? "pos"}>{riskState.label}</Pip>
        </Segment>
        <Segment label="시스템">
          {healthDown.length === 0 ? (
            <Pip tone="pos">전체 정상</Pip>
          ) : (
            <div className="flex items-center gap-2">
              {healthDown.map((h) => (
                <Pip key={h.label} tone={HEALTH_TONE[h.status]}>
                  {h.label}
                </Pip>
              ))}
            </div>
          )}
        </Segment>
      </div>
      {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
    </div>
  );
}
