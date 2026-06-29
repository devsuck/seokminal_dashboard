"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

interface NavItem { href: string; label: string; }
interface NavGroup { label: string; href?: string; items?: NavItem[]; }

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const { t } = useLanguage();

  const NAV_GROUPS: NavGroup[] = [
    { label: t("nav.dashboard"), href: "/dashboard" },
    { label: t("nav.market"),    href: "/market" },
    { label: t("nav.workflow"),  href: "/workflow" },
    {
      label: t("nav.research"),
      items: [
        { href: "/search",      label: t("nav.search") },
        { href: "/notebooks",   label: t("nav.notebooks") },
        { href: "/strategies",  label: t("nav.strategies") },
        { href: "/experiments", label: t("nav.experiments") },
        { href: "/quant",       label: t("nav.quant") },
        { href: "/options",     label: t("nav.options") },
        { href: "/futures",     label: t("nav.futures") },
        { href: "/forex",       label: t("nav.forex") },
        { href: "/crypto",      label: t("nav.crypto") },
        { href: "/ib",          label: t("nav.ib") },
        { href: "/report",      label: t("nav.report") },
      ],
    },
    {
      label: t("nav.analyze"),
      items: [
        { href: "/correlation",  label: t("nav.correlation") },
        { href: "/event-study",  label: t("nav.event-study") },
        { href: "/rolling",      label: t("nav.rolling") },
        { href: "/factor",       label: t("nav.factor") },
        { href: "/insider",      label: t("nav.insider") },
        { href: "/calendar",     label: t("nav.calendar") },
        { href: "/news",         label: t("nav.news") },
        { href: "/screener",     label: t("nav.screener") },
        { href: "/risk",         label: t("nav.risk") },
        { href: "/data-quality", label: t("nav.data-quality") },
      ],
    },
    {
      label: t("nav.trade"),
      items: [
        { href: "/backtest",         label: t("nav.backtest") },
        { href: "/backtest/compare", label: t("nav.compare") },
        { href: "/replay",           label: t("nav.replay") },
        { href: "/portfolio",        label: t("nav.portfolio") },
        { href: "/universe",         label: t("nav.universe") },
      ],
    },
    {
      label: t("nav.live"),
      items: [
        { href: "/spawner",   label: t("nav.spawner") },
        { href: "/bots",      label: t("nav.bots") },
        { href: "/orders",    label: t("nav.orders") },
        { href: "/alerts",    label: t("nav.alerts") },
        { href: "/ai-trader", label: t("nav.ai-trader") },
      ],
    },
  ];

  function isGroupActive(group: NavGroup): boolean {
    if (group.href) return pathname.startsWith(group.href);
    return group.items?.some(item => pathname.startsWith(item.href)) ?? false;
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setOpen(null); }, [pathname]);

  return (
    <nav ref={navRef} className="flex items-center gap-0.5">
      {NAV_GROUPS.map(group => {
        const active = isGroupActive(group);

        if (group.href) {
          return (
            <Link
              key={group.href}
              href={group.href}
              className={`px-3 py-1.5 text-sm rounded transition-colors duration-150 no-underline ${
                active ? "text-accent" : "text-text-3 hover:text-text-1"
              }`}
            >
              {group.label}
            </Link>
          );
        }

        return (
          <div key={group.label} className="relative">
            <button
              onClick={() => setOpen(open === group.label ? null : group.label)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors duration-150 bg-transparent border-0 cursor-pointer ${
                active || open === group.label ? "text-accent" : "text-text-3 hover:text-text-1"
              }`}
            >
              {group.label}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-60">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {open === group.label && (
              <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-panel border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
                {group.items!.map(item => {
                  const itemActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(null)}
                      className={`block px-3 py-1.5 text-sm no-underline transition-colors duration-100 ${
                        itemActive
                          ? "text-accent bg-accent/10"
                          : "text-text-2 hover:text-text-1 hover:bg-panel-2"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
