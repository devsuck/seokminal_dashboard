"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// ── IA: COMMAND CENTER 계층 (신규 콘솔 라우트) ──────────────────────
interface RailItem { href: string; label: string; ready?: boolean }
interface RailGroup { label: string; items: RailItem[] }

const GROUPS: RailGroup[] = [
  {
    label: "Intelligence",
    items: [
      { href: "/intel/research", label: "AI Research" },
      { href: "/intel/market", label: "Market Intelligence" },
      { href: "/intel/knowledge", label: "Knowledge Graph" },
    ],
  },
  {
    label: "Quant Lab",
    items: [
      { href: "/quant/hypothesis", label: "Hypothesis" },
      { href: "/quant/experiments", label: "Experiments" },
      { href: "/quant/backtests", label: "Backtests" },
      { href: "/quant/validation", label: "Validation" },
    ],
  },
  {
    label: "Portfolio OS",
    items: [
      { href: "/portfolio-os/allocation", label: "Allocation" },
      { href: "/portfolio-os/risk", label: "Risk" },
      { href: "/portfolio-os/positions", label: "Positions" },
    ],
  },
  {
    label: "Execution",
    items: [
      { href: "/exec/orders", label: "Orders" },
      { href: "/exec/broker", label: "Broker" },
      { href: "/exec/monitor", label: "Monitoring" },
    ],
  },
  {
    label: "AI Council",
    items: [
      { href: "/council/agents", label: "Agents" },
      { href: "/council/decisions", label: "Decisions" },
      { href: "/council/logs", label: "Logs" },
    ],
  },
];

// 콘솔 라우트 프리픽스(상단 레거시 네비 숨김 판정에 사용) — 기존 45페이지와 무충돌.
export const CONSOLE_PREFIXES = ["/command", "/intel", "/quant", "/portfolio-os", "/exec", "/council"];
export const isConsoleRoute = (p: string) => CONSOLE_PREFIXES.some((x) => p === x || p.startsWith(x + "/") || p.startsWith(x));

function Diamond() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
      <path d="M11 1.5 20.5 11 11 20.5 1.5 11Z" stroke="var(--c-hud)" strokeWidth="1.2" />
      <path d="M11 5.5 16.5 11 11 16.5 5.5 11Z" fill="var(--c-hud)" fillOpacity="0.12" stroke="var(--c-hud)" strokeWidth="0.8" />
      <circle cx="11" cy="11" r="1.6" fill="var(--c-hud)" />
    </svg>
  );
}

function GroupGlyph({ label }: { label: string }) {
  // 각 그룹을 상징하는 미니멀 글리프(1.4 stroke, currentColor)
  const g: Record<string, React.ReactNode> = {
    Intelligence: <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13" /></>,
    "Quant Lab": <><path d="M6 1.5v4L2.5 12A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 12L10 5.5v-4" /><path d="M5 1.5h6M4.5 9h7" /></>,
    "Portfolio OS": <><rect x="1.5" y="8" width="3" height="6" rx="0.5" /><rect x="6.5" y="4" width="3" height="10" rx="0.5" /><rect x="11.5" y="1.5" width="3" height="12.5" rx="0.5" /></>,
    Execution: <><path d="M2 8h3l1.5-4 3 8L13 8h1" /></>,
    "AI Council": <><rect x="4" y="5" width="8" height="6.5" rx="1.5" /><circle cx="6.5" cy="8.2" r="0.9" fill="currentColor" stroke="none" /><circle cx="9.5" cy="8.2" r="0.9" fill="currentColor" stroke="none" /><path d="M8 1.5v3.5M6 1.5h4" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {g[label]}
    </svg>
  );
}

export function CommandRail() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className={`console-rail relative flex flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${
        open ? "w-60" : "w-14"
      }`}
    >
      {/* ── Brand ── */}
      <Link
        href="/command"
        className="flex items-center gap-2.5 h-14 px-3.5 border-b border-[var(--c-border)] no-underline select-none shrink-0"
      >
        <Diamond />
        {open && (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-[var(--c-text-1)] leading-none">
              SEOKMIN·AI
            </div>
            <div className="text-[9px] tracking-[0.28em] text-[var(--c-hud)] mt-1 leading-none uppercase">
              Hedge Fund OS
            </div>
          </div>
        )}
      </Link>

      {/* ── Command Center (top-level) ── */}
      <Link
        href="/command"
        className={`group relative flex items-center gap-3 h-11 px-3.5 no-underline shrink-0 transition-colors ${
          isActive("/command")
            ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_9%,transparent)]"
            : "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"
        }`}
      >
        {isActive("/command") && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_10px_var(--c-hud)]" />}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
        </svg>
        {open && <span className="text-[12.5px] font-medium tracking-wide">Command Center</span>}
      </Link>

      {/* ── Groups ── */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-0.5">
            {open && (
              <div className="px-3.5 pt-3 pb-1 text-[9.5px] font-semibold tracking-[0.22em] text-[var(--c-text-3)] uppercase flex items-center gap-2">
                <GroupGlyph label={g.label} />
                {g.label}
              </div>
            )}
            {g.items.map((it) => {
              const active = isActive(it.href);
              const ready = it.ready ?? false;
              const cls = active
                ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)]"
                : ready
                ? "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"
                : "text-[var(--c-text-3)] cursor-default";
              const inner = (
                <div className={`group relative flex items-center gap-2.5 h-8 pl-7 pr-3 no-underline transition-colors ${cls}`}>
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_8px_var(--c-hud)]" />}
                  <span className={`h-1 w-1 rounded-full shrink-0 ${active ? "bg-[var(--c-hud)]" : ready ? "bg-[var(--c-text-3)]" : "bg-[var(--c-border)]"}`} />
                  {open && <span className="text-[12px] tracking-wide truncate flex-1">{it.label}</span>}
                  {open && !ready && (
                    <span className="text-[8px] font-semibold tracking-widest text-[var(--c-text-3)] border border-[var(--c-border)] px-1 py-px">SOON</span>
                  )}
                </div>
              );
              return ready ? (
                <Link key={it.href} href={it.href} className="block no-underline">{inner}</Link>
              ) : (
                <div key={it.href} title="구축 예정">{inner}</div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Footer: live status + collapse ── */}
      <div className="shrink-0 border-t border-[var(--c-border)]">
        {open && (
          <div className="flex items-center gap-2 px-3.5 h-9">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-warn)] animate-pulse shadow-[0_0_8px_var(--c-warn)]" />
            <span className="text-[10px] tracking-wider text-[var(--c-text-2)]">LIVE CAPITAL</span>
            <span className="text-[10px] font-semibold tracking-widest text-[var(--c-warn)] ml-auto">CLOSED</span>
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "" : "rotate-180"}`}>
            <path d="M9 3.5 5 7l4 3.5" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
