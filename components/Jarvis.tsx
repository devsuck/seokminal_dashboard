"use client";

import { useEffect, useRef, useState } from "react";

/* Jarvis — 하이테크 HUD 컴포넌트 모음.
   arc-reactor orb, live pulse, 카운트업 숫자, HUD 프레임.
   색은 디자인 토큰(accent/info/pos) + globals.css 애니메이션 토큰만 사용. */

/* ── 아크 리액터 오브: "AI 살아있음" 지표 ─────────────────────────── */
export function JarvisOrb({ size = 44, active = true }: { size?: 28 | 36 | 44 | 56 | 72; active?: boolean }) {
  const box = SIZE_CLASS[size] ?? SIZE_CLASS[44];
  const core = CORE_CLASS[size] ?? CORE_CLASS[44];
  return (
    <span className={`relative inline-flex items-center justify-center ${box}`} aria-hidden>
      {/* 확장 링(active만) */}
      {active && (
        <>
          <span className="absolute inset-0 rounded-full border border-accent/40 animate-[ring_2s_ease-out_infinite]" />
          <span className="absolute inset-0 rounded-full border border-accent/30 animate-[ring_2s_ease-out_infinite] [animation-delay:1s]" />
        </>
      )}
      {/* 회전 레이더 아크 */}
      <span className={`absolute inset-1 rounded-full border-2 border-transparent border-t-accent/70 border-r-accent/30 ${active ? "animate-[radar_3.2s_linear_infinite]" : ""}`} />
      {/* 코어 */}
      <span className={`rounded-full bg-accent/80 ${core} ${active ? "animate-[orb_3s_ease-in-out_infinite]" : "opacity-40"}`} />
    </span>
  );
}
const SIZE_CLASS: Record<number, string> = { 28: "w-7 h-7", 36: "w-9 h-9", 44: "w-11 h-11", 56: "w-14 h-14", 72: "w-[72px] h-[72px]" };
const CORE_CLASS: Record<number, string> = { 28: "w-2.5 h-2.5", 36: "w-3 h-3", 44: "w-4 h-4", 56: "w-5 h-5", 72: "w-6 h-6" };

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
