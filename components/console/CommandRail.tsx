"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ShutdownButton } from "@/components/ShutdownButton";
import { CommandPalette } from "@/components/console/CommandPalette";

// ── IA ──────────────────────────────────────────────────────────────
export interface RailItem { href: string; label: string }
export interface RailGroup { label: string; items: RailItem[] }

// 콘솔(거버넌스 OS) 그룹 — 신규 라우트. Phase 132 집행전환 최종목표의 메인 레이어라
// TERMINAL_GROUPS(레거시)보다 위계상 상위 — 항상 먼저 렌더.
// STEP4-D(docs/step4/dashboard_migration_map.md): "병합"/"숨김" 분류 페이지는 investment-os
// 5-tab 셸에 흡수되어 top-level nav에서 제거됨(route/파일은 무변경, 직링크로 계속 접근 가능).
// 남은 항목은 write action·drill-down이 있는 "유지" 페이지뿐.
const CONSOLE_GROUPS: RailGroup[] = [
  { label: "Research · 모니터링", items: [
    { href: "/research-os/cockpit", label: "경영진 콕핏" },
    { href: "/research-os/console", label: "운영 콘솔" },
  ] },
  { label: "Research · 파이프라인", items: [
    { href: "/research-os/agents", label: "리서치 에이전트" },
    { href: "/research-os/brain", label: "리서치 브레인" },
    { href: "/research-os/workflow", label: "워크플로우" },
    { href: "/research-os/discovery", label: "자율 발굴 v3.0" },
  ] },
  { label: "Research · 거버넌스", items: [
    { href: "/research-os/committee", label: "투자위원회" },
    { href: "/research-os/explain", label: "설명가능성" },
    { href: "/research-os/graph", label: "지식 그래프" },
    { href: "/research-os/timeline", label: "타임라인" },
  ] },
  { label: "Research · 랩", items: [
    { href: "/research-os/strategy-lab", label: "전략 랩" },
    { href: "/research-os/chat", label: "리서치 챗" },
    { href: "/intel/research-os", label: "Jarvis 라이브뷰" },
  ] },
  { label: "Investment OS", items: [
    { href: "/investment-os", label: "Investment OS" },
  ] },
];

// 레거시 트레이딩 터미널 그룹 — 기존 45페이지(기능 유지, 셸만 통합)
const TERMINAL_GROUPS: RailGroup[] = [
  { label: "마켓", items: [
    // crypto/futures/forex/options/news/calendar는 /market이 탭으로 그대로 렌더하는
    // 하위기능이라 최상위 nav에서 중복 노출하지 않음(진입은 /market 탭에서).
    { href: "/market", label: "마켓" },
    { href: "/orderflow", label: "오더플로우" },
  ] },
  { label: "트레이딩 데스크", items: [
    { href: "/hud", label: "HUD" },
    { href: "/overview", label: "AI 자본 개요" },
    { href: "/portfolio", label: "포트폴리오" },
    { href: "/lab/execution", label: "체결 콘솔" },
    { href: "/lab/tasks", label: "페이퍼 모니터" },
  ] },
  { label: "봇 · 에이전트", items: [
    { href: "/agents", label: "에이전트" },
    { href: "/performance", label: "성과" },
    { href: "/risk-guard", label: "리스크 가드" },
    { href: "/dart-auto", label: "DART 오토파일럿" },
    { href: "/copytrade", label: "카피트레이딩" },
    { href: "/polymarket", label: "Polymarket" },
  ] },
  { label: "리서치 랩", items: [
    { href: "/lab", label: "AI 랩" },
    // /auto-research 삭제: 코드 자체 주석이 "사이드바 은퇴, AI LAB에 흡수됨"이라 명시.
    { href: "/macro", label: "매크로 랩" },
    { href: "/infra", label: "공급망 그래프" },
    { href: "/buyback-doctor", label: "자사주매입 분석" },
    { href: "/insider", label: "내부자거래" },
    { href: "/edges", label: "엣지 포트폴리오" },
  ] },
  { label: "검증 · 백테스트", items: [
    { href: "/validation", label: "리서치 실험 로그" },
    { href: "/backtest", label: "백테스트" },
    { href: "/ict", label: "ICT 콤보" },
    { href: "/event-study", label: "이벤트 분석" },
    { href: "/signal", label: "스마트 시그널" },
    { href: "/experiments", label: "실험" },
    { href: "/data-quality", label: "데이터 품질" },
  ] },
];

const ALL_GROUPS: RailGroup[] = [...CONSOLE_GROUPS, ...TERMINAL_GROUPS];
const OPERATOR_GROUP_LABELS = ["트레이딩 데스크", "봇 · 에이전트", "Research · 모니터링"];
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
    "Research · 모니터링": <><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5v3.5l2.5 1.5" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /></>,
    "Research · 파이프라인": <><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13" /></>,
    "Research · 거버넌스": <><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 8h6M8 5v6" /></>,
    "Research · 랩": <><path d="M2 12 Q5 4 8 8 Q11 12 14 4" /><circle cx="14" cy="4" r="1.3" /></>,
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
    <nav className={`console-rail relative flex flex-col shrink-0 h-full border-r border-[var(--c-border)] bg-[var(--c-panel)] transition-[width] duration-200 ${open ? "w-60" : "w-14"}`}>
      {/* Brand */}
      <Link href="/command" className="flex items-center gap-2.5 h-14 px-3.5 border-b border-[var(--c-border)] no-underline select-none shrink-0">
        <Diamond />
        {open && (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-[var(--c-text-1)] leading-none">SEOKMIN·AI</div>
            <div className="text-[9px] tracking-[0.28em] text-[var(--c-hud)] mt-1 leading-none uppercase">헤지펀드 OS</div>
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
        {open && <span className="text-[12.5px] font-medium tracking-wide">커맨드 센터</span>}
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
