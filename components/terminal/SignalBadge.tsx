"use client";

import { toneColor, formatRelativeTime, type Tone } from "./tokens";

export type SignalKind = "BUY" | "SELL" | "WATCH" | "NEUTRAL";
export type Severity = "low" | "medium" | "high" | "critical";

const SIGNAL_TONE: Record<SignalKind, Tone> = {
  BUY: "pos",
  SELL: "neg",
  WATCH: "warn",
  NEUTRAL: "mute",
};

const SEVERITY_DOTS: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export interface SignalBadgeProps {
  signal: SignalKind;
  confidence?: number; // 0..1
  severity?: Severity;
  timestamp?: string | number | Date;
  className?: string;
}

export function SignalBadge({ signal, confidence, severity, timestamp, className = "" }: SignalBadgeProps) {
  const c = toneColor(SIGNAL_TONE[signal]);
  return (
    <span
      className={`inline-flex items-center gap-2 px-2 py-1 c-num ${className}`}
      style={{
        color: c,
        border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`,
        background: `color-mix(in srgb, ${c} 8%, transparent)`,
      }}
    >
      <span className="text-[10.5px] font-bold tracking-[0.12em]">{signal}</span>
      {confidence !== undefined && (
        <span className="text-[9.5px] text-[var(--c-text-2)]">{Math.round(confidence * 100)}%</span>
      )}
      {severity && (
        <span className="flex items-center gap-[2px]" title={`severity: ${severity}`}>
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full"
              style={{ background: i < SEVERITY_DOTS[severity] ? c : "var(--c-border-2)" }}
            />
          ))}
        </span>
      )}
      {timestamp !== undefined && (
        <span className="text-[9.5px] text-[var(--c-text-3)]">{formatRelativeTime(timestamp)}</span>
      )}
    </span>
  );
}
