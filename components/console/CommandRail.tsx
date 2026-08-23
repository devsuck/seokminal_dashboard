"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ShutdownButton } from "@/components/ShutdownButton";
import { CommandPalette } from "@/components/console/CommandPalette";
import { SettingsDrawer } from "@/components/console/SettingsDrawer";

// ── IA ──────────────────────────────────────────────────────────────
export interface RailItem { href: string; label: string }
export interface RailGroup { label: string; items: RailItem[] }

// 콘솔(거버넌스 OS) 그룹 — 신규 라우트. Phase 132 집행전환 최종목표의 메인 레이어라
// TERMINAL_GROUPS(레거시)보다 위계상 상위 — 항상 먼저 렌더.
// Research OS 4-shell 통합(2026-08-21): 옛 15개 research-os 라우트는 pipeline/validation/
// governance 3개 탭-셸 페이지(+ 손대지 않은 chat)로 합쳐짐. 옛 URL은 파일이 리다이렉트
// 스텁으로 재작성돼 307로 새 ?tab= 경로로 넘어감(lib/researchOsRedirects.ts 참고).
// 옛 라우트는 CommandPalette 검색에서는 여전히 찾을 수 있음 — 여기 visible nav에는 없음.
const CONSOLE_GROUPS: RailGroup[] = [
  { label: "Research OS", items: [
    { href: "/research-os/pipeline", label: "파이프라인" },
    { href: "/research-os/validation", label: "검증·실전준비" },
    { href: "/research-os/governance", label: "거버넌스" },
    { href: "/research-os/chat", label: "어시스턴트" },
  ] },
  { label: "Investment OS", items: [
    { href: "/investment-os", label: "Investment OS" },
  ] },
];

// 레거시 트레이딩 터미널 그룹 — 감시 전용 피벗(2026-08) 이후 20라우트로 축소
const TERMINAL_GROUPS: RailGroup[] = [
  { label: "마켓", items: [
    { href: "/orderflow", label: "오더플로우" },
  ] },
  { label: "트레이딩 데스크", items: [
    { href: "/portfolio", label: "포트폴리오" },
    { href: "/infra", label: "공급망 그래프" },
  ] },
  { label: "봇 · 에이전트", items: [
    { href: "/performance", label: "성과" },
    { href: "/dart-auto", label: "DART 오토파일럿" },
    { href: "/copytrade", label: "카피트레이딩" },
    { href: "/polymarket", label: "Polymarket" },
  ] },
];

export const ALL_GROUPS: RailGroup[] = [...CONSOLE_GROUPS, ...TERMINAL_GROUPS];
const OPERATOR_GROUP_LABELS = ["트레이딩 데스크", "봇 · 에이전트", "Research OS"];
const OPERATOR_MODE_KEY = "commandRailOperatorMode";

export function filterGroupsForOperator(groups: RailGroup[]): RailGroup[] {
  return groups.filter((g) => OPERATOR_GROUP_LABELS.includes(g.label));
}
const OPEN_GROUPS_KEY = "commandRailOpenGroups";

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
    "Research OS": <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13" /></>,
    "마켓": <><polyline points="1,11 4.5,6 7,8.5 10,4 14.5,8" /><line x1="1" y1="14" x2="15" y2="14" /></>,
    "트레이딩 데스크": <><rect x="1.5" y="2.5" width="13" height="9" rx="1" /><path d="M1.5 13.5h13M6 11.5v2M10 11.5v2" /></>,
    "봇 · 에이전트": <><rect x="3" y="5" width="10" height="7" rx="2" /><circle cx="6" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="8.5" r="1" fill="currentColor" stroke="none" /><path d="M8 2v3M6 2h4" /></>,
    "리서치 랩": <><path d="M2 12 Q5 4 8 8 Q11 12 14 4" /><circle cx="14" cy="4" r="1.3" /></>,
    "검증 · 백테스트": <><circle cx="8" cy="8" r="6.5" /><polyline points="8,4.5 8,8 11,10" /></>,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {g[label] ?? <circle cx="8" cy="8" r="3" />}
    </svg>
  );
}

export function CommandRail() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [operatorMode, setOperatorMode] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const groupIsActive = (g: RailGroup) => g.items.some((it) => isActive(it.href));

  // 70개 가까운 페이지가 늘 펼쳐진 채 쌓여있어 스크롤 없인 다 안 보였음 —
  // 현재 위치가 속한 그룹만 기본으로 펼치고 나머지는 접어서 스캔 부담을 줄임.
  // 사용자가 직접 펼친 그룹은 새로고침·이동 후에도 유지(localStorage).
  useEffect(() => {
    let stored: Record<string, boolean> = {};
    try {
      stored = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "{}");
    } catch { /* 저장된 값 손상 시 무시 */ }
    const active = ALL_GROUPS.find(groupIsActive);
    setOpenGroups(active ? { ...stored, [active.label]: true } : stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem(OPERATOR_MODE_KEY);
    if (stored !== null) setOperatorMode(stored === "true");
  }, []);

  function toggleOperatorMode() {
    setOperatorMode((prev) => {
      const next = !prev;
      localStorage.setItem(OPERATOR_MODE_KEY, String(next));
      return next;
    });
  }

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const renderGroups = (groups: RailGroup[]) =>
    groups.map((g) => {
      // 목적지가 하나뿐인 그룹(Investment OS 등)은 아코디언 없이 바로 링크
      if (g.items.length === 1) {
        const it = g.items[0];
        const active = isActive(it.href);
        return (
          <Link key={g.label} href={it.href} className="block no-underline">
            <div className={`group relative flex items-center gap-2.5 h-8 px-3.5 no-underline transition-colors ${
              active ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_8%,transparent)]"
                     : "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"}`}>
              {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_8px_var(--c-hud)]" />}
              <GroupGlyph label={g.label} />
              {open && <span className="text-[12px] tracking-wide truncate flex-1">{g.label}</span>}
            </div>
          </Link>
        );
      }

      const expanded = !!openGroups[g.label];
      return (
        <div key={g.label} className="mb-0.5">
          <button
            onClick={() => toggleGroup(g.label)}
            className={`w-full flex items-center gap-2 px-3.5 pt-3 pb-1 border-0 bg-transparent cursor-pointer text-[9.5px] font-semibold tracking-[0.2em] uppercase transition-colors ${
              groupIsActive(g) ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)] hover:text-[var(--c-text-2)]"}`}
          >
            <GroupGlyph label={g.label} />
            {open && <span className="flex-1 text-left">{g.label}</span>}
            {open && (
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className={`shrink-0 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}>
                <line x1="2" y1="3.5" x2="5" y2="6.5" /><line x1="8" y1="3.5" x2="5" y2="6.5" />
              </svg>
            )}
          </button>
          {(expanded || !open) && g.items.map((it) => {
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
      );
    });

  return (
    <>
    <nav className={`rail-ap console-rail hidden md:flex relative flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${open ? "w-60" : "w-14"}`}>
      {/* Brand */}
      <Link href="/hud" className="flex items-center gap-2.5 h-14 px-3.5 border-b border-[var(--c-border)] no-underline select-none shrink-0">
        <Diamond />
        {open && (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-[var(--c-text-1)] leading-none">SEOKMIN·AI</div>
            <div className="text-[9px] tracking-[0.28em] text-[var(--c-hud)] mt-1 leading-none uppercase">헤지펀드 OS</div>
          </div>
        )}
      </Link>

      {/* Home */}
      <Link href="/hud" className={`group relative flex items-center gap-3 h-11 px-3.5 no-underline shrink-0 transition-colors ${
        isActive("/hud") ? "text-[var(--c-hud)] bg-[color-mix(in_srgb,var(--c-hud)_9%,transparent)]"
                             : "text-[var(--c-text-2)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)]"}`}>
        {isActive("/hud") && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--c-hud)] shadow-[0_0_10px_var(--c-hud)]" />}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
        </svg>
        {open && <span className="text-[12.5px] font-medium tracking-wide">홈</span>}
      </Link>

      {/* Search */}
      <div className="border-b border-[var(--c-border)] shrink-0">
        <CommandPalette groups={ALL_GROUPS} iconOnly={!open} />
      </div>

      {/* Groups (scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
        {renderGroups(operatorMode ? filterGroupsForOperator(CONSOLE_GROUPS) : CONSOLE_GROUPS)}
        {/* divider → 레거시 트레이딩 터미널 */}
        <div className="mt-3 mb-1 mx-3.5 border-t border-[var(--c-border)]" />
        {open && <div className="px-3.5 pt-1 pb-1 text-[8.5px] font-semibold tracking-[0.28em] text-[var(--c-text-3)] uppercase opacity-70">터미널 · 레거시</div>}
        {renderGroups(operatorMode ? filterGroupsForOperator(TERMINAL_GROUPS) : TERMINAL_GROUPS)}
      </div>

      {/* Footer: status + shutdown + collapse */}
      <div className="shrink-0 border-t border-[var(--c-border)]">
        {open && (
          <div className="flex items-center gap-2 px-3.5 h-9">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-warn)] animate-pulse shadow-[0_0_8px_var(--c-warn)]" />
            <span className="text-[10px] tracking-wider text-[var(--c-text-2)]">실전 자본</span>
            <span className="text-[10px] font-semibold tracking-widest text-[var(--c-warn)] ml-auto">휴장</span>
          </div>
        )}
        {open && (
          <div className="flex items-center gap-2 px-3.5 h-9 border-t border-[var(--c-border)]">
            <span className="text-[9px] c-num text-[var(--c-text-3)]">{new Date().toISOString().slice(0, 10)}</span>
            <ShutdownButton collapsed />
          </div>
        )}
        <button onClick={toggleOperatorMode}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors text-[10px] tracking-wide">
          {open ? (operatorMode ? "전체보기" : "간단히 보기") : (operatorMode ? "전체" : "간단")}
        </button>
        <button onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors text-[10px] tracking-wide">
          {open ? "⚙ 설정" : "⚙"}
        </button>
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center w-full h-8 border-t border-[var(--c-border)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-panel-2)] bg-transparent border-x-0 border-b-0 cursor-pointer transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "" : "rotate-180"}`}>
            <path d="M9 3.5 5 7l4 3.5" />
          </svg>
        </button>
      </div>
    </nav>
    <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
