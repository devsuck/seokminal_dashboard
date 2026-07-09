"use client";

import { useEffect, useRef, useState } from "react";

/* Jarvis — 하이테크 HUD 컴포넌트 모음.
   live pulse, 카운트업 숫자, HUD 프레임.
   색은 디자인 토큰(accent/info/pos) + globals.css 애니메이션 토큰만 사용. */

/* ── 라이브 펄스 점 (상태 표시) ──────────────────────────────────── */
export function LivePulse({ tone = "pos", label }: { tone?: "pos" | "accent" | "info" | "neg" | "text-3"; label?: string }) {
  const c = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex w-2 h-2">
        <span className={`absolute inset-0 rounded-full ${c.bg} animate-[ring_2s_ease-out_infinite]`} />
        <span className={`relative inline-flex w-2 h-2 rounded-full ${c.solid}`} />
      </span>
      {label && <span className={`text-[11px] font-data ${c.text}`}>{label}</span>}
    </span>
  );
}
const TONE = {
  pos:    { bg: "bg-pos/60", solid: "bg-pos", text: "text-pos" },
  accent: { bg: "bg-accent/60", solid: "bg-accent", text: "text-accent" },
  info:   { bg: "bg-info/60", solid: "bg-info", text: "text-info" },
  neg:    { bg: "bg-neg/60", solid: "bg-neg", text: "text-neg" },
  "text-3": { bg: "bg-text-3/40", solid: "bg-text-3", text: "text-text-3" },
} as const;

/* ── 카운트업 숫자 (metric 착지 애니메이션) ──────────────────────── */
export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", className = "" }:
  { value: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const [disp, setDisp] = useState(0);
  const raf = useRef<number | null>(null);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(); const dur = 600; const a = from.current; const b = value;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisp(a + (b - a) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick); else from.current = b;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);
  return <span className={`font-data tabular-nums ${className}`}>{prefix}{disp.toFixed(decimals)}{suffix}</span>;
}

/* ── 타이핑 커서 (AI가 "생각 중" 텍스트) ─────────────────────────── */
export function ThinkingLine({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-data text-[12px] text-accent">
      <span>{text}</span>
      <span className="inline-block w-1.5 h-3.5 bg-accent animate-[blink_1.2s_steps(1)_infinite]" />
    </span>
  );
}
