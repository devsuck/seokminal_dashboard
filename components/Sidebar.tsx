"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, type Lang } from "@/lib/i18n";
import { ShutdownButton } from "@/components/ShutdownButton";
import { JokerLogo } from "@/components/JokerLogo";

const LANGS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

interface NavItem  { href: string; label: string; }
interface NavGroup { label: string; icon: React.ReactNode; href?: string; items?: NavItem[]; }

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function IconMarket() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,12 4.5,7 7,9.5 10,5 14.5,9" />
      <line x1="1" y1="14.5" x2="15" y2="14.5" />
    </svg>
  );
}

function IconDiscovery() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <line x1="10" y1="10" x2="14.5" y2="14.5" />
    </svg>
  );
}

function IconAnalyze() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="2" x2="3" y2="9" />
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="13" y1="2" x2="13" y2="6" />
      <path d="M1 9 Q3 12 5 9" />
      <path d="M6 14 Q8 11 10 14" />
      <path d="M11 6 Q13 9 15 6" />
    </svg>
  );
}

function IconStrategy() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1.5" width="10" height="13" rx="1.5" />
      <line x1="5" y1="5.5" x2="9" y2="5.5" />
      <line x1="5" y1="8" x2="10" y2="8" />
      <line x1="5" y1="10.5" x2="8" y2="10.5" />
      <path d="M10 1.5 L14 5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 1.5 L14 1.5 L14 5.5" />
    </svg>
  );
}

function IconBacktest() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <polyline points="8,4.5 8,8 11,10" />
      <path d="M3.5 2.5 L1.5 1 M1.5 1 L1.5 4 M1.5 1 L4.5 1" />
    </svg>
  );
}

function IconTrading() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2 L3 8 L6.5 8 L4 14 L13 6 L9 6 L12 2 Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconAgent() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="10" height="8" rx="2" />
      <circle cx="6" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="9" r="1" fill="currentColor" stroke="none" />
      <path d="M6 2 L6 5 M10 2 L10 5" />
      <line x1="5" y1="2" x2="11" y2="2" />
    </svg>
  );
}

function IconResearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12 Q5 4 8 8 Q11 12 14 4" />
      <circle cx="14" cy="4" r="1.5" />
      <line x1="2" y1="14" x2="14" y2="14" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const NAV_GROUPS: NavGroup[] = [
    // HUD — 홈
    { label: "HUD 커맨드", icon: <IconDashboard />, href: "/hud" },
    // 집행 — 돈이 실제로 움직이는 곳
    {
      label: "집행", icon: <IconTrading />,
      items: [
        { href: "/lab/execution", label: "집행 콘솔 (돈길)" },
        { href: "/lab/tasks",     label: "Lab Task (페이퍼 모니터)" },
        { href: "/overview",      label: "총 포트폴리오" },
        { href: "/portfolio",     label: "계좌 현황" },
        { href: "/orders",        label: "주문 현황 (OMS)" },
      ],
    },
    // AI 에이전트 — 봇 관리·자동화
    {
      label: "AI 에이전트", icon: <IconAgent />,
      items: [
        { href: "/agents",         label: t("nav.agents") },
        { href: "/performance",    label: "성과 추적" },
        { href: "/risk-guard",     label: "리스크 관리" },
        { href: "/dart-auto",      label: "DART 자동매매" },
        { href: "/copytrade",      label: "카피트레이드" },
        { href: "/vrp",            label: "VRP 옵션 (아이언 콘도어)" },
        { href: "/polymarket",     label: "Polymarket 다각화" },
      ],
    },
    // 리서치 — 가설·인사이트 탐색
    {
      label: "리서치", icon: <IconResearch />,
      items: [
        { href: "/lab",            label: "AI LAB (사냥 · 파킹)" },
        { href: "/macro",          label: "Macro Lab (거시 분석)" },
        { href: "/infra",          label: "공급망 그래프 (LKG)" },
        { href: "/buyback-doctor", label: "Buyback 손실진단" },
        { href: "/insider",        label: t("nav.insider") },
      ],
    },
    // 검증 — 엣지 찾고 검증
    {
      label: "검증", icon: <IconBacktest />,
      items: [
        { href: "/validation",   label: "검증 터미널" },
        { href: "/backtest",     label: t("nav.backtest") },
        { href: "/ict",          label: "ICT 조합 백테스트" },
        { href: "/event-study",  label: t("nav.event-study") },
        { href: "/signal",       label: "스마트 시그널" },
        { href: "/data-quality", label: t("nav.data-quality") },
        { href: "/universe",     label: t("nav.universe") },
        { href: "/pairs",        label: "페어(공적분)" },
      ],
    },
    // 마켓 — 차트·뉴스·데이터
    {
      label: "마켓", icon: <IconMarket />,
      items: [
        { href: "/market",    label: t("nav.market") },
        { href: "/news",      label: t("nav.news") },
        { href: "/calendar",  label: t("nav.calendar") },
        { href: "/ib",        label: t("nav.ib") },
        { href: "/orderflow", label: "오더플로우" },
      ],
    },
  ];

  useEffect(() => {
    for (const g of NAV_GROUPS) {
      if (g.href && pathname.startsWith(g.href)) { setOpenGroup(null); return; }
      if (g.items?.some(i => pathname.startsWith(i.href))) {
        setOpenGroup(g.label);
        return;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function isGroupActive(g: NavGroup) {
    if (g.href) return pathname.startsWith(g.href);
    return g.items?.some(i => pathname.startsWith(i.href)) ?? false;
  }

  return (
    <aside
      className={`h-screen sticky top-0 hidden md:flex flex-col bg-panel border-r border-border shrink-0 transition-all duration-200 ${
        collapsed ? "w-12" : "w-52"}`}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center h-12 border-b border-border shrink-0 ${collapsed ? "px-0 justify-center" : "px-3"}`}>
        {!collapsed && (
          <span className="flex items-center gap-2 flex-1 select-none">
            <JokerLogo size={20} />
            <span className="text-text-1 font-semibold text-sm tracking-widest uppercase">SEOKMINAL</span>
          </span>
        )}
        {collapsed && <JokerLogo size={18} />}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-6 h-6 flex items-center justify-center text-text-3 hover:text-text-1 rounded transition-colors bg-transparent border-0 cursor-pointer"title={collapsed ? "Expand" : "Collapse"}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {collapsed
              ? <><line x1="3" y1="2" x2="9" y2="6" /><line x1="3" y1="10" x2="9" y2="6" /></>
              : <><line x1="9" y1="2" x2="3" y2="6" /><line x1="9" y1="10" x2="3" y2="6" /></>
            }
          </svg>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map(g => {
          const active = isGroupActive(g);
          const isOpen = openGroup === g.label;

          if (g.href) {
            return (
              <Link
                key={g.href}
                href={g.href}
                title={collapsed ? g.label : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 mx-1 mb-0.5 rounded text-sm no-underline transition-colors ${
                  active
                    ? "bg-accent/15 text-accent": "text-text-3 hover:text-text-1 hover:bg-panel-2"} ${collapsed ? "justify-center" : ""}`}
              >
                <span className="shrink-0 flex items-center">{g.icon}</span>
                {!collapsed && <span className="truncate font-medium">{g.label}</span>}
              </Link>
            );
          }

          return (
            <div key={g.label} className="mb-0.5">
              <button
                onClick={() => !collapsed && setOpenGroup(isOpen ? null : g.label)}
                title={collapsed ? g.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 mx-0 text-sm cursor-pointer border-0 bg-transparent transition-colors rounded mx-1 ${
                  active ? "text-accent" : "text-text-3 hover:text-text-1 hover:bg-panel-2"} ${collapsed ? "justify-center" : ""}`}
              >
                <span className="shrink-0 flex items-center">{g.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate text-xs uppercase tracking-wider font-semibold">
                      {g.label}
                    </span>
                    <svg
                      width="10" height="10" viewBox="0 0 10 10" fill="none"stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"className={`shrink-0 text-text-3 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                    >
                      <line x1="3" y1="2" x2="7" y2="5" />
                      <line x1="3" y1="8" x2="7" y2="5" />
                    </svg>
                  </>
                )}
              </button>

              {!collapsed && isOpen && (
                <div className="mt-0.5 mb-1">
                  {/* longest-match만 활성 — startsWith만 쓰면 /lab/execution에서 /lab도 같이 켜짐 */}
                  {(() => {
                    const best = g.items!
                      .filter(i => pathname === i.href || pathname.startsWith(i.href + "/"))
                      .sort((a, b) => b.href.length - a.href.length)[0];
                    return g.items!.map(item => {
                      const itemActive = item === best;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center pl-9 pr-3 py-1.5 mx-1 rounded text-sm no-underline transition-colors ${
                          itemActive
                            ? "bg-accent/15 text-accent font-medium": "text-text-2 hover:text-text-1 hover:bg-panel-2"}`}
                      >
                        {item.label}
                      </Link>
                    );
                    });
                  })()}
                </div>
              )}

              {/* Collapsed active indicator */}
              {collapsed && active && (
                <div className="w-0.5 h-4 bg-accent rounded-full mx-auto -mt-1" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Shutdown */}
      <div className={`border-t border-border shrink-0 ${collapsed ? "py-2 flex justify-center" : "px-3 py-2"}`}>
        <ShutdownButton collapsed={collapsed} />
      </div>

      <div className={`border-t border-border shrink-0 ${collapsed ? "py-2" : "px-3 py-2.5"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                title={label}
                className={`w-7 h-5 text-[10px] font-semibold rounded transition-colors bg-transparent cursor-pointer border-0 ${
                  lang === code ? "text-accent" : "text-text-3 hover:text-text-1"}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-3 font-data">
              {new Date().toISOString().slice(0, 10)}
            </span>
            <div className="flex items-center gap-0.5">
              {LANGS.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors bg-transparent cursor-pointer border-0 ${
                    lang === code ? "text-accent" : "text-text-3 hover:text-text-1"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
