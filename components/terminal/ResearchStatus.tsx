"use client";

import { Panel, PanelHead } from "@/components/console/primitives";
import { toneColor, type Tone } from "./tokens";

// "Data Agent ONLINE / Research Agent RUNNING / Validation PASSED / Execution LOCKED" 형태의
// 에이전트 상태 롤콜. status 문자열은 자유 입력이고, 알려진 값만 톤 매핑 — 미지정 값은 mute로 안전 폴백.

export type AgentStatus =
  | "ONLINE" | "OFFLINE" | "DEGRADED"
  | "RUNNING" | "IDLE" | "PENDING"
  | "PASSED" | "FAILED"
  | "LOCKED" | "UNLOCKED"
  | string;

export interface ResearchStatusItem {
  label: string;
  status: AgentStatus;
  detail?: string;
}

const STATUS_TONE: Record<string, Tone> = {
  ONLINE: "pos", RUNNING: "hud", PASSED: "pos", UNLOCKED: "pos",
  IDLE: "info", PENDING: "info",
  DEGRADED: "warn", LOCKED: "warn",
  OFFLINE: "neg", FAILED: "neg",
};

export interface ResearchStatusProps {
  title?: string;
  kicker?: string;
  items: ResearchStatusItem[];
  className?: string;
}

export function ResearchStatus({ title = "에이전트 상태", kicker = "OPS", items, className = "" }: ResearchStatusProps) {
  return (
    <Panel className={className}>
      <PanelHead kicker={kicker} title={title} />
      <div className="divide-y divide-[var(--c-border)]">
        {items.map((item) => {
          const tone = STATUS_TONE[item.status] ?? "mute";
          const c = toneColor(tone);
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                <span className="text-[11.5px] text-[var(--c-text-1)] truncate">{item.label}</span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0">
                {item.detail && <span className="text-[10px] c-num text-[var(--c-text-3)]">{item.detail}</span>}
                <span className="text-[10.5px] font-semibold tracking-[0.1em] c-num" style={{ color: c }}>
                  {item.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
