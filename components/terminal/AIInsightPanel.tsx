"use client";

import { Panel } from "@/components/console/primitives";
import { formatRelativeTime } from "./tokens";

// 기관 애널리스트 노트 스타일. 감사 §3.3 권고 원칙: hud(cyan)는 이 앱에서 "모델이 생성한 판단"
// 전용 색이며 다른 어떤 데이터 표시에도 쓰지 않는다 — 그래야 사용자가 색만 보고
// "이건 원본 시장 데이터가 아니라 AI 해석"임을 즉시 구분할 수 있다.

export interface AIInsightPanelProps {
  agent?: string;
  summary: string;
  reasoning?: string | string[];
  confidence?: number; // 0..1 — omit when the source doesn't produce a numeric confidence score
  timestamp: string | number | Date;
  className?: string;
}

export function AIInsightPanel({ agent, summary, reasoning, confidence, timestamp, className = "" }: AIInsightPanelProps) {
  const reasons = Array.isArray(reasoning) ? reasoning : reasoning ? [reasoning] : [];
  const confPct = confidence !== undefined ? Math.round(Math.max(0, Math.min(1, confidence)) * 100) : null;

  return (
    <Panel hud className={`relative p-4 overflow-hidden ${className}`}>
      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)]" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-semibold tracking-[0.22em] text-[var(--c-hud)] uppercase">
          {agent ?? "AI Insight"}
        </span>
        <span className="text-[9.5px] c-num text-[var(--c-text-3)]">{formatRelativeTime(timestamp)}</span>
      </div>

      <div className="mt-2 text-[12.5px] leading-snug text-[var(--c-text-1)]">{summary}</div>

      {reasons.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className="text-[11px] leading-snug text-[var(--c-text-2)] flex gap-2">
              <span className="text-[var(--c-hud)] shrink-0">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {confPct !== null && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[9px] tracking-[0.16em] text-[var(--c-text-3)] uppercase">Confidence</span>
          <div className="h-1 flex-1 bg-[var(--c-panel-3)] overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${confPct}%`, background: "var(--c-hud)", boxShadow: "0 0 8px var(--c-hud)" }}
            />
          </div>
          <span className="text-[10.5px] c-num font-semibold text-[var(--c-hud)]">{confPct}%</span>
        </div>
      )}
    </Panel>
  );
}
