"use client";

import { useRef, type ReactNode } from "react";

// ── Panel ─────────────────────────────────────────────────────────
export function ApPanel({
  children, className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function ApPanelHead({
  title, kicker, right,
}: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 min-h-10 py-1.5 px-4 border-b border-ap-line">
      <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
        {kicker && <span className="text-ap-micro font-semibold tracking-[0.22em] text-ap-brand uppercase">{kicker}</span>}
        <span className="text-ap-title font-semibold tracking-wide text-ap-ink-1 truncate">{title}</span>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2 text-ap-ink-2 text-ap-body font-data">{right}</div>}
    </div>
  );
}

// ── Status dot ────────────────────────────────────────────────────
const AP_TONE: Record<string, string> = {
  pos: "var(--color-ap-up)", neg: "var(--color-ap-down)", warn: "var(--color-ap-caution)",
  hud: "var(--color-ap-brand)", info: "var(--color-ap-note)", mute: "var(--color-ap-ink-3)",
};
export function ApDot({ tone = "mute", pulse = false }: { tone?: keyof typeof AP_TONE | string; pulse?: boolean }) {
  const c = AP_TONE[tone] ?? tone;
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${pulse ? "animate-pulse" : ""}`}
      style={{ background: c }}
    />
  );
}

// ── Stat tile ─────────────────────────────────────────────────────
export function ApStatTile({
  label, value, unit, sub, tone = "ink-1", accent,
}: {
  label: string; value: ReactNode; unit?: string; sub?: ReactNode;
  tone?: "ink-1" | "hud" | "pos" | "neg" | "warn"; accent?: keyof typeof AP_TONE;
}) {
  const valColor =
    tone === "hud" ? "text-ap-brand" :
    tone === "pos" ? "text-ap-up" :
    tone === "neg" ? "text-ap-down" :
    tone === "warn" ? "text-ap-caution" : "text-ap-ink-1";
  return (
    <ApPanel className="relative p-4">
      {accent && <span className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: AP_TONE[accent] }} />}
      <div className="text-ap-body font-semibold tracking-[0.2em] text-ap-ink-3 uppercase">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-data text-ap-hero leading-none font-semibold ${valColor}`}>{value}</span>
        {unit && <span className="text-ap-body text-ap-ink-2">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-ap-body text-ap-ink-2">{sub}</div>}
    </ApPanel>
  );
}

// ── Badge ─────────────────────────────────────────────────────────
export function ApBadge({ children, tone = "mute", title }: { children: ReactNode; tone?: keyof typeof AP_TONE; title?: string }) {
  const c = AP_TONE[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-ap-sm text-ap-body font-semibold tracking-[0.14em] uppercase font-data whitespace-nowrap"
      style={{ color: c, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)` }}
    >
      {children}
    </span>
  );
}

// ── Skeleton (로딩 placeholder) ────────────────────────────────────
export function ApSkeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-ap-line ${className}`} />;
}

export function ApSkeletonStatTile() {
  return (
    <ApPanel className="p-4 space-y-2.5">
      <ApSkeleton className="h-2 w-16" />
      <ApSkeleton className="h-5 w-12" />
    </ApPanel>
  );
}

export function ApSkeletonLines({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  const widths = ["w-full", "w-5/6", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <ApSkeleton key={i} className={`h-3 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}

// ── Meter (0..1) ──────────────────────────────────────────────────
export function ApMeter({ value, tone = "hud" }: { value: number; tone?: keyof typeof AP_TONE }) {
  const c = AP_TONE[tone];
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1 w-full bg-ap-line overflow-hidden rounded-full">
      <div className="h-full transition-[width] duration-500 rounded-full" style={{ width: `${pct}%`, background: c }} />
    </div>
  );
}

// ── Ticker badge (심볼 해시 기반 원형 뱃지, 외부 로고 없음) ──────────────────
export function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function ApTickerBadge({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const hue = hashHue(symbol);
  const text = symbol.slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.38),
        background: `hsl(${hue} 60% 90%)`, color: `hsl(${hue} 55% 28%)`,
      }}
    >
      {text}
    </span>
  );
}

// ── Gain bar (평단가→현재가 손익률 막대, 시계열 대체) ──────────────────────
export function gainBarWidthPct(pct: number, maxAbs: number): number {
  const denom = Math.max(1e-9, Math.abs(maxAbs));
  return Math.max(0, Math.min(100, (Math.abs(pct) / denom) * 100));
}

export function ApGainBar({ pct, maxAbs }: { pct: number; maxAbs: number }) {
  const width = gainBarWidthPct(pct, maxAbs);
  const tone = pct >= 0 ? "var(--color-ap-up)" : "var(--color-ap-down)";
  return (
    <div className="h-1.5 w-full min-w-[36px] bg-ap-line rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: tone }} />
    </div>
  );
}

// ── List row (범용 리스트 항목 — leading/title/subtitle + trailing/trailingSub) ──
export function ApListRow({
  leading, title, subtitle, trailing, trailingSub, onClick,
}: {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode;
  trailing?: ReactNode; trailingSub?: ReactNode; onClick?: () => void;
}) {
  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ap-ink-1 truncate">{title}</div>
        {subtitle && <div className="text-xs text-ap-ink-3 truncate mt-0.5">{subtitle}</div>}
      </div>
      {(trailing || trailingSub) && (
        <div className="shrink-0 text-right">
          {trailing && <div className="text-sm font-mono font-semibold text-ap-ink-1">{trailing}</div>}
          {trailingSub && <div className="mt-1">{trailingSub}</div>}
        </div>
      )}
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick}
        className="flex items-center gap-3 w-full min-h-11 py-2 px-3 text-left border-0 bg-transparent cursor-pointer active:bg-ap-bg">
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 w-full min-h-11 py-2 px-3">{content}</div>;
}

// ── Bottom sheet (스와이프-다운으로 닫히는 모바일 시트) ─────────────────────
export function shouldDismissSheet(startY: number | null, endY: number, threshold = 80): boolean {
  return startY !== null && endY - startY > threshold;
}

export function ApBottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const swipeStartY = useRef<number | null>(null);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-h-[80vh] overflow-y-auto bg-ap-surface border-t border-ap-line rounded-t-xl pb-[env(safe-area-inset-bottom)]"
        onTouchStart={(e) => { swipeStartY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          if (shouldDismissSheet(swipeStartY.current, e.changedTouches[0].clientY)) onClose();
          swipeStartY.current = null;
        }}>
        <div className="sticky top-0 flex items-center justify-between px-4 h-11 border-b border-ap-line bg-ap-surface">
          <span className="text-sm font-semibold text-ap-ink-1 truncate">{title}</span>
          <button onClick={onClose}
            className="text-ap-ink-3 text-xs border-0 bg-transparent cursor-pointer min-h-11 min-w-11 px-3 flex items-center justify-center shrink-0">
            닫기
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function ApLightHero({
  label, value, valueCls, sub, rows,
}: {
  label: string;
  value: string;
  valueCls?: string;
  sub?: string;
  rows?: { label: string; value: string; cls?: string }[];
}) {
  return (
    <div className="rounded-ap-xl bg-ap-surface shadow-ap-sm overflow-hidden">
      <div className="p-4">
        <div className="text-ap-body uppercase tracking-wide text-ap-ink-3">{label}</div>
        <div className={`text-2xl font-bold font-data mt-1 ${valueCls ?? "text-ap-ink-1"}`}>{value}</div>
        {sub && <div className="text-xs text-ap-ink-3 mt-0.5">{sub}</div>}
      </div>
      {rows && rows.length > 0 && (
        <div className="divide-y divide-ap-line px-4">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ap-ink-3">{r.label}</span>
              <span className={`font-data ${r.cls ?? "text-ap-ink-1"}`}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ApGateStep({ label, value, title, state }: {
  label: string; value: string; title?: string; state: "done" | "current" | "blocked" | "pending";
}) {
  const tone = state === "done" ? "text-ap-up" : state === "blocked" ? "text-ap-down"
    : state === "current" ? "text-ap-brand" : "text-ap-ink-3";
  const bar = state === "done" ? "bg-ap-up" : state === "blocked" ? "bg-ap-down"
    : state === "current" ? "bg-ap-brand" : "bg-ap-line";
  return (
    <div className="flex-1 min-w-0 px-1.5 pb-1.5">
      <div className={`h-0.5 mb-1 ${bar}`} />
      <p className="text-ap-ink-3 text-ap-micro uppercase tracking-wider truncate">{label}</p>
      <p className={`font-data text-xs font-bold truncate ${tone}`} title={title}>{value}</p>
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────
export type ApButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ApButtonSize = "sm" | "md";

const AP_BUTTON_VARIANT: Record<ApButtonVariant, string> = {
  primary:   "bg-ap-brand text-white",
  secondary: "bg-ap-bg text-ap-ink-1",
  danger:    "border border-ap-down/30 text-ap-down/70 hover:bg-ap-down/8 hover:text-ap-down hover:border-ap-down/50 bg-transparent",
  ghost:     "bg-transparent text-ap-ink-2",
};

const AP_BUTTON_SIZE: Record<ApButtonSize, string> = {
  sm: "h-9 text-ap-label px-3",
  md: "h-11 text-ap-title px-4",
};

export function ApButton({
  variant = "primary",
  size = "sm",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: {
  variant?: ApButtonVariant;
  size?: ApButtonSize;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-ap-md font-semibold border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${AP_BUTTON_VARIANT[variant]} ${AP_BUTTON_SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? "…" : children}
    </button>
  );
}
