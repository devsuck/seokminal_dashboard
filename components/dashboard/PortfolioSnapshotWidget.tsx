"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAllBotsLiveStatus, getAlpacaAccount, getPaperState, type BotLiveEntry, type AlpacaAccount, type PaperState } from "@/lib/api";

export function PortfolioSnapshotWidget() {
  const [bots, setBots] = useState<BotLiveEntry[]>([]);
  const [alpaca, setAlpaca] = useState<AlpacaAccount | null>(null);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [loading, setLoading] = useState(true);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    Promise.allSettled([
      getAllBotsLiveStatus(ctrl.signal),
      getAlpacaAccount(),
      getPaperState(),
    ]).then(([botsRes, alpacaRes, paperRes]) => {
      if (ctrl.signal.aborted) return;
      if (botsRes.status === "fulfilled") setBots(botsRes.value.bots);
      if (alpacaRes.status === "fulfilled") setAlpaca(alpacaRes.value);
      if (paperRes.status === "fulfilled") setPaper(paperRes.value);
      setLoading(false);
    });

    return () => ctrl.abort();
  }, []);

  const running = bots.filter(b => b.running);
  const totalUnrPnl = running.reduce((s, b) => s + (b.unrealized_pnl ?? 0), 0);
  const openPositions = running.filter(b => b.position !== "FLAT").length;

  const usdTotal = (alpaca?.equity ?? 0) + (paper?.capital ?? 0);
  const paperPnl = paper ? paper.capital - 10_000 : null;

  function fmtUsd(v: number) {
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  return (
    <div className="bg-panel border border-border rounded-lg p-4 h-full flex flex-col">
      <span className="text-text-3 text-[11px] uppercase tracking-wider font-semibold block mb-3">
        Portfolio Snapshot
      </span>

      {loading ? (
        <p className="text-text-3 text-xs">로딩 중…</p>
      ) : (
        <div className="space-y-0 flex-1">
          {/* 계좌 잔고 */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">USD 합계</span>
            <span className="text-text-1 text-xs font-data font-semibold">{fmtUsd(usdTotal)}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs pl-2">· Alpaca</span>
            <span className="text-text-2 text-xs font-data">{alpaca ? fmtUsd(alpaca.equity) : "—"}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs pl-2">· LKG 페이퍼</span>
            <span className={`text-xs font-data ${paperPnl != null && paperPnl >= 0 ? "text-pos" : paperPnl != null ? "text-neg" : "text-text-2"}`}>
              {paper ? fmtUsd(paper.capital) : "—"}
              {paperPnl != null && <span className="text-[10px] ml-1">({paperPnl >= 0 ? "+" : ""}{paperPnl.toFixed(0)})</span>}
            </span>
          </div>

          {/* 봇 상태 */}
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">실행 중 봇</span>
            <span className="text-text-1 text-xs font-data font-medium">{running.length} / {bots.length}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">오픈 포지션</span>
            <span className="text-text-1 text-xs font-data font-medium">{openPositions}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-text-3 text-xs">미실현 P&L</span>
            <span className={`text-xs font-data font-semibold ${totalUnrPnl >= 0 ? "text-pos" : "text-neg"}`}>
              {totalUnrPnl >= 0 ? "+" : ""}{totalUnrPnl.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <Link
          href="/portfolio"
          className="block text-center text-xs text-accent hover:text-accent/80 transition-colors no-underline border border-accent/30 rounded-md py-1.5">
          계좌 현황 →
        </Link>
        <Link
          href="/bots"
          className="block text-center text-xs text-text-3 hover:text-text-1 transition-colors no-underline border border-border rounded-md py-1.5">
          봇 관리 →
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
