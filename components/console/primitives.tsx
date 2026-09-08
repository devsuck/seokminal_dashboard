"use client";

import type { ReactNode } from "react";

// ── Panel ─────────────────────────────────────────────────────────
export function Panel({
  children, className = "", hud = false, grid = false,
}: { children: ReactNode; className?: string; hud?: boolean; grid?: boolean }) {
  return (
    <div className={`relative ${hud ? "c-panel-hud" : "c-panel"} ${grid ? "c-grid overflow-hidden" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function PanelHead({
  title, kicker, right,
}: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 min-h-10 py-1.5 px-4 border-b border-[var(--c-border)]">
      <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
        {kicker && <span className="text-[9px] font-semibold tracking-[0.22em] text-[var(--c-hud)] uppercase">{kicker}</span>}
        <span className="text-[13px] font-semibold tracking-wide text-[var(--c-text-1)] truncate">{title}</span>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────
const TONE: Record<string, string> = {
  pos: "var(--c-pos)", neg: "var(--c-neg)", warn: "var(--c-warn)",
  hud: "var(--c-hud)", info: "var(--c-info)", mute: "var(--c-text-3)",
};
export function Dot({ tone = "mute", pulse = false }: { tone?: keyof typeof TONE | string; pulse?: boolean }) {
  const c = TONE[tone] ?? tone;
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: c, boxShadow: `0 0 8px ${c}` }}
    />
  );
}

// ── Stat tile ─────────────────────────────────────────────────────
export function StatTile({
  label, value, unit, sub, tone = "text-1", accent,
}: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode;
  tone?: "text-1" | "hud" | "pos" | "neg" | "warn"; accent?: keyof typeof TONE;
}) {
  const valColor =
    tone === "hud" ? "text-[var(--c-hud)]" :
    tone === "pos" ? "text-[var(--c-pos)]" :
    tone === "neg" ? "text-[var(--c-neg)]" :
    tone === "warn" ? "text-[var(--c-warn)]" : "text-[var(--c-text-1)]";
  return (
    <Panel className="relative p-4 overflow-hidden">
      {accent && <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: TONE[accent] }} />}
      <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`c-num text-[26px] leading-none font-semibold ${valColor}`}>{value}</span>
        {unit && <span className="text-[11px] text-[var(--c-text-2)]">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-[var(--c-text-2)]">{sub}</div>}
    </Panel>
  );
}

// ── Badge ─────────────────────────────────────────────────────────
export function Badge({ children, tone = "mute" }: { children: ReactNode; tone?: keyof typeof TONE }) {
  const c = TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.14em] uppercase c-num whitespace-nowrap"
      style={{ color: c, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}
    >
      {children}
    </span>
  );
}

// ── Skeleton (로딩 placeholder) ────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-[var(--c-border)] ${className}`} />;
}

export function SkeletonStatTile() {
  return (
    <Panel className="p-4 space-y-2.5">
      <Skeleton className="h-2 w-16" />
      <Skeleton className="h-5 w-12" />
    </Panel>
  );
}

export function SkeletonLines({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  const widths = ["w-full", "w-5/6", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

// ── Meter (0..1) ──────────────────────────────────────────────────
export function Meter({ value, tone = "hud" }: { value: number; tone?: keyof typeof TONE }) {
  const c = TONE[tone];
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1 w-full bg-[var(--c-panel-3)] overflow-hidden">
      <div className="h-full transition-[width] duration-500" style={{ width: `${pct}%`, background: c, boxShadow: `0 0 8px ${c}` }} />
    </div>
  );
}
