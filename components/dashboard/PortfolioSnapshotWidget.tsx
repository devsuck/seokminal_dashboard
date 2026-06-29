"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAllBotsLiveStatus, type BotLiveEntry } from "@/lib/api";

function getAllBotsLiveStatusFn(signal?: AbortSignal) {
  return getAllBotsLiveStatus(signal);
}

export function PortfolioSnapshotWidget() {
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    getAllBotsLiveStatusFn(ctrl.signal)
      .then(res => { if (!ctrl.signal.aborted) setBots(res.bots); })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, []);

  const running = bots.filter(b => b.running);
  const totalUnrPnl = running.reduce((s, b) => s + (b.unrealized_pnl ?? 0), 0);
  const openPositions = running.filter(b => b.position !== "FLAT").length;
  const longCount = running.filter(b => b.position === "LONG").length;
  const shortCount = running.filter(b => b.position === "SHORT").length;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full flex flex-col">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Portfolio Snapshot
      </span>

      {loading ? (
        <p className="text-text-3 text-xs">Loading…</p>
      ) : (
        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">실행 중 봇</span>
            <span className="text-text-1 text-xs font-data font-medium">{running.length} / {bots.length}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">오픈 포지션</span>
            <span className="text-text-1 text-xs font-data font-medium">{openPositions}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">Long / Short</span>
            <span className="text-xs font-data">
              <span className="text-pos">{longCount}L</span>
              <span className="text-text-3 mx-1">/</span>
              <span className="text-neg">{shortCount}S</span>
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">미실현 P&L</span>
            <span className={`text-xs font-data font-semibold ${totalUnrPnl >= 0 ? "text-pos" : "text-neg"}`}>
              {totalUnrPnl >= 0 ? "+" : ""}{totalUnrPnl.toFixed(2)}
            </span>
          </div>
          {bots.length === 0 && (
            <p className="text-text-3 text-[10px] text-center pt-2">봇 없음</p>
          )}
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <Link
          href="/bots"
          className="block text-center text-xs text-accent hover:text-accent/80 transition-colors no-underline border border-accent/30 rounded-md py-1.5"
        >
          봇 관리 →
        </Link>
        <Link
          href="/portfolio"
          className="block text-center text-xs text-text-3 hover:text-text-1 transition-colors no-underline border border-border rounded-md py-1.5"
        >
          포트폴리오 최적화 →
        </Link>
      </div>
    </div>
  );
}
