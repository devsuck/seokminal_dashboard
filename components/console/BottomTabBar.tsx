"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ALL_GROUPS } from "./CommandRail";
import { SettingsDrawer } from "./SettingsDrawer";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// 오더플로우는 AI 내부용 정보(사람이 모바일에서 볼 이유 없음, 2026-08-23 피드백) —
// 기본 탭에서 빼고 "더보기" 시트(ALL_GROUPS "마켓" 그룹)로만 남겨둠.
const PRIMARY_TABS = [
  { href: "/hud", label: "홈" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/research-os/pipeline", label: "Research OS" },
];

function TabIcon({ href, active }: { href: string; active: boolean }) {
  const stroke = active ? "var(--c-hud)" : "var(--c-text-3)";
  const props = { width: 21, height: 21, viewBox: "0 0 16 16", fill: "none", stroke, strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "shrink-0" };
  switch (href) {
    case "/hud":
      return <svg {...props}><circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" /></svg>;
    case "/portfolio":
      return <svg {...props}><rect x="1.5" y="2.5" width="13" height="9" rx="1" /><path d="M1.5 13.5h13M6 11.5v2M10 11.5v2" /></svg>;
    case "/research-os/pipeline":
      return <svg {...props}><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13" /></svg>;
    default:
      return null;
  }
}

function MoreIcon({ active }: { active: boolean }) {
  const stroke = active ? "var(--c-hud)" : "var(--c-text-3)";
  return (
    <svg width="21" height="21" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" className="shrink-0">
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="5" cy="8" r="0.9" fill={stroke} stroke="none" />
      <circle cx="8" cy="8" r="0.9" fill={stroke} stroke="none" />
      <circle cx="11" cy="8" r="0.9" fill={stroke} stroke="none" />
    </svg>
  );
}

/** 아이폰 폭(<768px)용 하단 탭바 — CommandRail은 그 폭에서 hidden. 네이티브 iOS 탭바 관례대로
 *  4개 고정 탭 + "더보기"(탭 안 눌린 나머지 라우트는 시트로). */
export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const swipeStartY = useRef<number | null>(null);
  const inPrimary = PRIMARY_TABS.some((t) => isActivePath(pathname, t.href));
  const moreActive = moreOpen || !inPrimary;

  return (
    <>
      <nav className="rail-ap fixed bottom-0 inset-x-0 z-40 flex md:hidden items-stretch h-14 pb-[env(safe-area-inset-bottom)] border-t border-[var(--c-border)] bg-[var(--c-panel)]/95 backdrop-blur">
        {PRIMARY_TABS.map((t) => {
          const active = isActivePath(pathname, t.href);
          return (
            <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center justify-center gap-0.5 no-underline">
              <TabIcon href={t.href} active={active} />
              <span className={`text-[10px] tracking-wide ${active ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)]"}`}>{t.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 border-0 bg-transparent cursor-pointer">
          <MoreIcon active={moreActive} />
          <span className={`text-[10px] tracking-wide ${moreActive ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)]"}`}>더보기</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="rail-ap fixed inset-0 bg-black/60 z-50 flex md:hidden items-end"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}>
          <div className="w-full max-h-[70vh] overflow-y-auto bg-[var(--c-panel)] border-t border-[var(--c-border)] rounded-t-xl pb-[env(safe-area-inset-bottom)]"
            onTouchStart={(e) => { swipeStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              if (swipeStartY.current !== null && e.changedTouches[0].clientY - swipeStartY.current > 80) setMoreOpen(false);
              swipeStartY.current = null;
            }}>
            <div className="sticky top-0 flex items-center justify-between px-4 h-11 border-b border-[var(--c-border)] bg-[var(--c-panel)]">
              <span className="text-[13px] font-semibold text-[var(--c-text-1)]">전체 메뉴</span>
              <button onClick={() => setMoreOpen(false)} className="text-[var(--c-text-3)] text-xs border-0 bg-transparent cursor-pointer min-h-11 min-w-11 px-3 flex items-center justify-center">닫기</button>
            </div>
            <button onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
              className="flex items-center h-10 px-4 w-full text-left border-0 border-b border-[var(--c-border)] bg-transparent cursor-pointer text-[13px] text-[var(--c-text-2)] active:bg-[var(--c-panel-2)]">
              ⚙ 설정 · 리스크 가드
            </button>
            {ALL_GROUPS.map((g) => (
              <div key={g.label} className="py-2">
                <div className="px-4 pb-1 text-[9.5px] font-semibold tracking-[0.2em] uppercase text-[var(--c-text-3)]">{g.label}</div>
                {g.items.map((it) => (
                  <Link key={it.href} href={it.href} onClick={() => setMoreOpen(false)}
                    className="flex items-center h-10 px-4 no-underline text-[13px] text-[var(--c-text-2)] active:bg-[var(--c-panel-2)]">
                    {it.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
