"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface UpdateStatus {
  running: boolean;
  last_updated: string | null;
  update_count: number;
}

interface PaperSummary {
  capital: number;
  positions: number;
  pnl: number;
}

export function StrategyHubWidget() {
  const [lkg, setLkg] = useState<UpdateStatus | null>(null);
  const [paper, setPaper] = useState<PaperSummary | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [statusRes, paperRes] = await Promise.allSettled([
          fetch(`${API_URL}/graph/update-status`).then(r => r.ok ? r.json() : null),
          fetch(`${API_URL}/graph/paper`).then(r => r.ok ? r.json() : null),
        ]);
        if (!alive) return;
        if (statusRes.status === "fulfilled" && statusRes.value) setLkg(statusRes.value);
        if (paperRes.status === "fulfilled" && paperRes.value) {
          const s = paperRes.value;
          const openPnl = (s.positions ?? []).reduce((sum: number, p: { value: number; qty: number; entry_price: number }) =>
            sum + (p.value - p.qty * p.entry_price), 0);
          const closedPnl = (s.closed ?? []).reduce((sum: number, c: { pnl: number }) => sum + c.pnl, 0);
          setPaper({ capital: s.capital, positions: (s.positions ?? []).length, pnl: openPnl + closedPnl });
        }
      } catch { /* ignore */ }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  function fmtTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const lkgPnl = paper ? paper.capital - 10_000 : null;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full flex flex-col">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Strategy Hub
      </span>

      <div className="space-y-0 flex-1">
        {/* LKG 그래프 */}
        <div className="pb-2 mb-2 border-b border-border/40">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lkg?.running ? "bg-pos animate-pulse" : "bg-text-3"}`} />
            <span className="text-text-2 text-[11px] font-medium">LKG 공급망 그래프</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-3 text-[10px]">마지막 AI 업데이트</span>
            <span className="text-text-2 text-[10px] font-data">{fmtTime(lkg?.last_updated ?? null)}</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-text-3 text-[10px]">총 사이클</span>
            <span className="text-text-2 text-[10px] font-data">{lkg?.update_count ?? "—"}</span>
          </div>
        </div>

        {/* LKG 페이퍼 */}
        <div className="pb-2 mb-2 border-b border-border/40">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-warn" />
            <span className="text-text-2 text-[11px] font-medium">LKG 페이퍼 트레이딩</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-3 text-[10px]">포지션</span>
            <span className="text-text-2 text-[10px] font-data">{paper?.positions ?? "—"} 개</span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-text-3 text-[10px]">누적 P&L</span>
            <span className={`text-[10px] font-data ${lkgPnl != null && lkgPnl >= 0 ? "text-pos" : lkgPnl != null ? "text-neg" : "text-text-3"}`}>
              {lkgPnl != null ? `${lkgPnl >= 0 ? "+" : ""}$${lkgPnl.toFixed(0)}` : "—"}
            </span>
          </div>
        </div>

        {/* Macro Lab */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-info" />
            <span className="text-text-2 text-[11px] font-medium">Macro Lab</span>
          </div>
          <div className="flex gap-1.5">
            <Link href="/macro" className="flex-1 text-center text-[10px] text-text-3 hover:text-text-1 border border-border rounded py-1 no-underline transition-colors">
              🇰🇷 KR
            </Link>
            <Link href="/macro" className="flex-1 text-center text-[10px] text-text-3 hover:text-text-1 border border-border rounded py-1 no-underline transition-colors">
              🇺🇸 US
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Link
          href="/infra"
          className="block text-center text-xs text-accent hover:text-accent/80 transition-colors no-underline border border-accent/30 rounded-md py-1.5">
          LKG 그래프 →
        </Link>
        <Link
          href="/macro"
          className="block text-center text-xs text-text-3 hover:text-text-1 transition-colors no-underline border border-border rounded-md py-1.5">
          Macro Lab →
        </Link>
      </div>
    </div>
  );
}
