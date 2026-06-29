"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem { href: string; label: string; }
interface NavGroup { label: string; href?: string; items?: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Market",    href: "/market" },
  { label: "Workflow",  href: "/workflow" },
  {
    label: "Research",
    items: [
      { href: "/search",      label: "Search" },
      { href: "/notebooks",   label: "Notebooks" },
      { href: "/strategies",  label: "Strategies" },
      { href: "/experiments", label: "Experiments" },
      { href: "/quant",       label: "Quant" },
      { href: "/options",     label: "Options" },
      { href: "/futures",     label: "Futures" },
      { href: "/forex",       label: "Forex" },
      { href: "/crypto",      label: "Crypto" },
      { href: "/ib",          label: "IB Data" },
      { href: "/report",      label: "Report" },
    ],
  },
  {
    label: "Analyze",
    items: [
      { href: "/correlation",  label: "Correlation" },
      { href: "/event-study",  label: "Event Study" },
      { href: "/rolling",      label: "Rolling" },
      { href: "/factor",       label: "Factor" },
      { href: "/risk",         label: "Risk" },
      { href: "/data-quality", label: "Data Quality" },
    ],
  },
  {
    label: "Trade",
    items: [
      { href: "/backtest",         label: "Backtest" },
      { href: "/backtest/compare", label: "Compare" },
      { href: "/replay",           label: "Replay" },
      { href: "/portfolio",        label: "Portfolio" },
      { href: "/universe",         label: "Universe" },
    ],
  },
  {
    label: "Live",
    items: [
      { href: "/spawner",   label: "Spawner" },
      { href: "/bots",      label: "Bots" },
      { href: "/orders",    label: "Orders" },
      { href: "/alerts",    label: "Alerts" },
      { href: "/ai-trader", label: "AI Trader" },
    ],
  },
];

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

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
