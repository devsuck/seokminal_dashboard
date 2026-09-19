"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SettingsDrawer } from "./SettingsDrawer";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// 5탭 고정 — "더보기"(전체 메뉴 시트) 삭제. 모바일엔 AI 내부용 리서치 툴이
// 아니라 사람이 실제로 보는 5개만: 홈/포트폴리오/에이전트/성과/자본청구.
// 그 외(research-os 등)는 데스크톱 CommandRail 사이드바로만 접근.
const PRIMARY_TABS: { href: string; label: string; matchPrefix?: string }[] = [
  { href: "/hud", label: "홈" },
  { href: "/portfolio", label: "포트폴리오" },
  { href: "/investment-os/live-agents", label: "에이전트" },
  { href: "/investment-os/capital-claims", label: "자본청구" },
  { href: "/performance", label: "성과" },
];

function TabIcon({ href, active }: { href: string; active: boolean }) {
  const stroke = active ? "var(--c-hud)" : "var(--c-text-3)";
  const props = { width: 21, height: 21, viewBox: "0 0 16 16", fill: "none", stroke, strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "shrink-0" };
  switch (href) {
    case "/hud":
      return <svg {...props}><circle cx="8" cy="8" r="6.5" /><circle cx="8" cy="8" r="2" /><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" /></svg>;
    case "/portfolio":
      return <svg {...props}><rect x="1.5" y="2.5" width="13" height="9" rx="1" /><path d="M1.5 13.5h13M6 11.5v2M10 11.5v2" /></svg>;
    case "/investment-os/live-agents":
      return <svg {...props}><rect x="3" y="5" width="10" height="7" rx="2" /><circle cx="6" cy="8.5" r="1" fill={stroke} stroke="none" /><circle cx="10" cy="8.5" r="1" fill={stroke} stroke="none" /><path d="M8 2v3M6 2h4" /></svg>;
    case "/investment-os/capital-claims":
      return <svg {...props}><circle cx="8" cy="8" r="6.5" /><path d="M8 4.5v7M6 10.3c0 .9.9 1.7 2 1.7s2-.8 2-1.7-.9-1.5-2-1.7-2-.8-2-1.7.9-1.7 2-1.7 2 .8 2 1.7" /></svg>;
    case "/performance":
      return <svg {...props}><path d="M2 12l4-4 3 3 5-6" /><path d="M11 5h3v3" /></svg>;
    default:
      return null;
  }
}

function SettingsIcon() {
  const stroke = "var(--c-text-3)";
  return (
    <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.1 3.9l-1.1 1.1M5 10l-1.1 1.1M12.1 12.1l-1.1-1.1M5 6l-1.1-1.1" />
    </svg>
  );
}

/** 아이폰 폭(<768px)용 하단 탭바 — CommandRail은 그 폭에서 hidden. 네이티브 iOS 탭바 관례대로
 *  4개 고정 탭 + "더보기"(탭 안 눌린 나머지 라우트는 시트로). */
export function BottomTabBar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isHome = isActivePath(pathname, "/hud");

  return (
    <>
      {isHome && (
        <button onClick={() => setSettingsOpen(true)} aria-label="설정 · 리스크 가드"
          className="rail-ap fixed top-3 right-3 z-40 flex md:hidden items-center justify-center w-9 h-9 rounded-full border-0 bg-[var(--c-panel)]/90 backdrop-blur cursor-pointer">
          <SettingsIcon />
        </button>
      )}

      <nav className="rail-ap fixed bottom-0 inset-x-0 z-40 flex md:hidden items-stretch h-14 pb-[env(safe-area-inset-bottom)] border-t border-[var(--c-border)] bg-[var(--c-panel)]/95 backdrop-blur">
        {PRIMARY_TABS.map((t) => {
          const active = isActivePath(pathname, t.matchPrefix ?? t.href);
          return (
            <Link key={t.href} href={t.href} className="flex-1 flex flex-col items-center justify-center gap-0.5 no-underline">
              <TabIcon href={t.href} active={active} />
              <span className={`text-[10px] leading-tight text-center px-0.5 ${active ? "text-[var(--c-hud)]" : "text-[var(--c-text-3)]"}`}>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
