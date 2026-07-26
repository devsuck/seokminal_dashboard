"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage, type Lang } from "@/lib/i18n";
import { ShutdownButton } from "@/components/ShutdownButton";

// ── IA ──────────────────────────────────────────────────────────────
interface RailItem { href: string; label: string }
interface RailGroup { label: string; items: RailItem[] }

// 콘솔(거버넌스 OS) 그룹 — 신규 라우트
const CONSOLE_GROUPS: RailGroup[] = [
  { label: "Research OS", items: [
    { href: "/research-os/organization", label: "Research Org" },
    { href: "/research-os/intelligence", label: "Intelligence" },
    { href: "/research-os/market", label: "Market Intelligence" },
    { href: "/research-os/live-intelligence", label: "Live Intelligence" },
    { href: "/research-os/intel-feed", label: "Market Intel Feed" },
    { href: "/research-os/cockpit", label: "Executive Cockpit" },
    { href: "/research-os/committee", label: "Investment Committee" },
    { href: "/research-os/strategy-lab", label: "Strategy Lab" },
    { href: "/research-os/agents", label: "Research Agents" },
    { href: "/research-os/brain", label: "Research Brain" },
    { href: "/research-os/validation", label: "Validation Loop" },
    { href: "/research-os/autonomous", label: "Autonomous Runtime" },
    { href: "/research-os/workflow", label: "Workflow" },
    { href: "/research-os/chat", label: "Research Chat" },
    { href: "/research-os/timeline", label: "Timeline" },
    { href: "/research-os/graph", label: "Knowledge Graph" },
    { href: "/research-os/explain", label: "Explainability" },
    { href: "/research-os/console", label: "Operating Console" },
  ] },
  { label: "Intelligence", items: [
    { href: "/intel/assistant", label: "Assistant" },
    { href: "/intel/research-os", label: "Research OS" },
    { href: "/intel/research", label: "AI Research" },
    { href: "/intel/market", label: "Market Intelligence" },
    { href: "/intel/knowledge", label: "Knowledge Graph" },
  ] },
  { label: "Quant Lab", items: [
    { href: "/quant/hypothesis", label: "Hypothesis" },
    { href: "/quant/experiments", label: "Strategy DNA" },
    { href: "/quant/backtests", label: "Backtests" },
    { href: "/quant/validation", label: "Validation" },
  ] },
  { label: "Portfolio OS", items: [
    { href: "/portfolio-os/allocation", label: "Allocation" },
    { href: "/portfolio-os/risk", label: "Risk" },
    { href: "/portfolio-os/positions", label: "Positions" },
  ] },
  { label: "Execution", items: [
    { href: "/exec/orders", label: "Orders" },
    { href: "/exec/broker", label: "Broker" },
    { href: "/exec/monitor", label: "Monitoring" },
  ] },
  { label: "AI Council", items: [
    { href: "/council/agents", label: "Agents" },
    { href: "/council/decisions", label: "Decisions" },
    { href: "/council/logs", label: "Logs" },
  ] },
];

// 레거시 트레이딩 터미널 그룹 — 기존 45페이지(기능 유지, 셸만 통합)
const TERMINAL_GROUPS: RailGroup[] = [
  { label: "Markets", items: [
    { href: "/market", label: "Market" },
    { href: "/orderflow", label: "Orderflow" },
    { href: "/crypto", label: "Crypto" },
    { href: "/futures", label: "Futures" },
    { href: "/forex", label: "Forex" },
    { href: "/options", label: "Options" },
    { href: "/news", label: "News" },
    { href: "/calendar", label: "Calendar" },
    { href: "/ib", label: "IB Data" },
  ] },
  { label: "Trading Desk", items: [
    { href: "/hud", label: "HUD" },
    { href: "/overview", label: "Overview" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/orders", label: "Orders (OMS)" },
    { href: "/pnl", label: "PnL" },
    { href: "/lab/execution", label: "Execution Console" },
    { href: "/lab/tasks", label: "Paper Monitor" },
  ] },
  { label: "Bots & Agents", items: [
    { href: "/agents", label: "Agents" },
    { href: "/performance", label: "Performance" },
    { href: "/risk-guard", label: "Risk Guard" },
    { href: "/dart-auto", label: "DART Auto" },
    { href: "/copytrade", label: "Copytrade" },
    { href: "/vrp", label: "VRP Options" },
    { href: "/polymarket", label: "Polymarket" },
  ] },
  { label: "Research Lab", items: [
    { href: "/lab", label: "AI Lab" },
    { href: "/auto-research", label: "Auto Research" },
    { href: "/macro", label: "Macro Lab" },
    { href: "/infra", label: "Supply Graph" },
    { href: "/buyback-doctor", label: "Buyback Doctor" },
    { href: "/insider", label: "Insider" },
  ] },
  { label: "Validation & Backtest", items: [
    { href: "/validation", label: "Validation Terminal" },
    { href: "/backtest", label: "Backtest" },
    { href: "/ict", label: "ICT Combos" },
    { href: "/event-study", label: "Event Study" },
    { href: "/signal", label: "Smart Signal" },
    { href: "/experiments", label: "Experiments" },
    { href: "/data-quality", label: "Data Quality" },
    { href: "/universe", label: "Universe" },
    { href: "/pairs", label: "Pairs" },
  ] },
];

const LANGS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한" }, { code: "en", label: "EN" }, { code: "de", label: "DE" },
];

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
  const g: Record<string, React.ReactNode> = {
    "Research OS": <><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5v3.5l2.5 1.5" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /></>,
    Intelligence: <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13" /></>,
    "Quant Lab": <><path d="M6 1.5v4L2.5 12A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 12L10 5.5v-4" /><path d="M5 1.5h6M4.5 9h7" /></>,
    "Portfolio OS": <><rect x="1.5" y="8" width="3" height="6" rx="0.5" /><rect x="6.5" y="4" width="3" height="10" rx="0.5" /><rect x="11.5" y="1.5" width="3" height="12.5" rx="0.5" /></>,
    Execution: <><path d="M2 8h3l1.5-4 3 8L13 8h1" /></>,
    "AI Council": <><rect x="4" y="5" width="8" height="6.5" rx="1.5" /><circle cx="6.5" cy="8.2" r="0.9" fill="currentColor" stroke="none" /><circle cx="9.5" cy="8.2" r="0.9" fill="currentColor" stroke="none" /><path d="M8 1.5v3.5M6 1.5h4" /></>,
    Markets: <><polyline points="1,11 4.5,6 7,8.5 10,4 14.5,8" /><line x1="1" y1="14" x2="15" y2="14" /></>,
    "Trading Desk": <><rect x="1.5" y="2.5" width="13" height="9" rx="1" /><path d="M1.5 13.5h13M6 11.5v2M10 11.5v2" /></>,
    "Bots & Agents": <><rect x="3" y="5" width="10" height="7" rx="2" /><circle cx="6" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="8.5" r="1" fill="currentColor" stroke="none" /><path d="M8 2v3M6 2h4" /></>,
    "Research Lab": <><path d="M2 12 Q5 4 8 8 Q11 12 14 4" /><circle cx="14" cy="4" r="1.3" /></>,
    "Validation & Backtest": <><circle cx="8" cy="8" r="6.5" /><polyline points="8,4.5 8,8 11,10" /></>,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {g[label] ?? <circle cx="8" cy="8" r="3" />}
    </svg>
  );
}

export function CommandRail() {
  const pathname = usePathname();
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(true);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const renderGroups = (groups: RailGroup[]) =>
    groups.map((g) => (
      <div key={g.label} className="mb-0.5">
        {open && (
          <div className="px-3.5 pt-3 pb-1 text-[9.5px] font-semibold tracking-[0.2em] text-[var(--c-text-3)] uppercase flex items-center gap-2">
            <GroupGlyph label={g.label} />{g.label}
          </div>
        )}
        {g.items.map((it) => {
          const active = isActive(it.href);
          return (
            <Link key={it.href} href={it.href} className="block no-underline">
              <div className={`group relative flex items-center gap-2.5 h-8 pl-7 pr-3 no-underline transition-colors ${
                active ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)]"
                       : "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"}`}>
                {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_8px_var(--c-hud)]" />}
                <span className={`h-1 w-1 rounded-full shrink-0 ${active ? "bg-[var(--c-hud)]" : "bg-[var(--c-text-3)]"}`} />
                {open && <span className="text-[12px] tracking-wide truncate flex-1">{it.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    ));

  return (
    <nav className={`console-rail relative flex flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${open ? "w-60" : "w-14"}`}>
      {/* Brand */}
      <Link href="/command" className="flex items-center gap-2.5 h-14 px-3.5 border-b border-[var(--c-border)] no-underline select-none shrink-0">
        <Diamond />
        {open && (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-[var(--c-text-1)] leading-none">SEOKMIN·AI</div>
            <div className="text-[9px] tracking-[0.28em] text-[var(--c-hud)] mt-1 leading-none uppercase">Hedge Fund OS</div>
          </div>
        )}
      </Link>

      {/* Command Center */}
      <Link href="/command" className={`group relative flex items-center gap-3 h-11 px-3.5 no-underline shrink-0 transition-colors ${
        isActive("/command") ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_9%,transparent)]"
                             : "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"}`}>
        {isActive("/command") && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_10px_var(--c-hud)]" />}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
        </svg>
        {open && <span className="text-[12.5px] font-medium tracking-wide">Command Center</span>}
      </Link>

      {/* Groups (scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
        {renderGroups(CONSOLE_GROUPS)}
        {/* divider → 레거시 트레이딩 터미널 */}
        <div className="mt-3 mb-1 mx-3.5 border-t border-[var(--c-border)]" />
        {open && <div className="px-3.5 pt-1 pb-1 text-[8.5px] font-semibold tracking-[0.28em] text-[var(--c-text-3)] uppercase opacity-70">Terminal · Legacy</div>}
        {renderGroups(TERMINAL_GROUPS)}
      </div>

      {/* Footer: status + lang + shutdown + collapse */}
      <div className="shrink-0 border-t border-[var(--c-border)]">
        {open && (
          <div className="flex items-center gap-2 px-3.5 h-9">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-warn)] animate-pulse shadow-[0_0_8px_var(--c-warn)]" />
            <span className="text-[10px] tracking-wider text-[var(--c-text-2)]">LIVE CAPITAL</span>
            <span className="text-[10px] font-semibold tracking-widest text-[var(--c-warn)] ml-auto">CLOSED</span>
          </div>
        )}
        {open && (
          <div className="flex items-center gap-2 px-3.5 h-9 border-t border-[var(--c-border)]">
            <div className="flex items-center gap-0.5">
              {LANGS.map(({ code, label }) => (
                <button key={code} onClick={() => setLang(code)}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors bg-transparent cursor-pointer border-0 ${lang === code ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)] hover:text-[var(--c-text-1)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[9px] c-num text-[var(--c-text-3)] ml-auto">{new Date().toISOString().slice(0, 10)}</span>
            <ShutdownButton collapsed />
          </div>
        )}
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "" : "rotate-180"}`}>
            <path d="M9 3.5 5 7l4 3.5" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

// 하위호환: 이전에 AppChrome이 쓰던 export(현재는 전 페이지 레일 통일이라 미사용).
export const CONSOLE_PREFIXES = ["/command", "/research-os", "/intel", "/quant", "/portfolio-os", "/exec", "/council"];
export const isConsoleRoute = (p: string) => CONSOLE_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));
