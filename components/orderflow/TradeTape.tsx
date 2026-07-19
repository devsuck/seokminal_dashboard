"use client";

import type { RecentTrade } from "@/lib/orderflow-data";

function formatClock(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface TradeTapeProps {
  trades: RecentTrade[];
}

/** 실제 체결 테이프 — 개별 체결(가격/수량/방향) 최신순 스크롤. footprint_delta의 ts 있는 것만 쌓인 raw print. */
export function TradeTape({ trades }: TradeTapeProps) {
  const maxSize = Math.max(1, ...trades.slice(0, 30).map((t) => t.size));
  return (
    <div className="flex flex-col h-full text-[10px] font-data border-l border-border">
      <div className="px-2 py-1 border-b border-border text-text-3">체결 테이프</div>
      <div className="grid grid-cols-3 px-2 py-0.5 text-text-3 border-b border-border shrink-0">
        <span>시각</span>
        <span className="text-right">가격</span>
        <span className="text-right">수량</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="px-2 py-2 text-text-3">체결 대기 중</div>
        ) : (
          trades.map((t, i) => (
            <div
              key={`${t.ts}-${i}`}
              className={`relative grid grid-cols-3 px-2 py-[1px] ${t.side === "buy" ? "text-pos" : "text-neg"}`}
            >
              <div
                className={`absolute inset-y-0 right-0 pointer-events-none ${t.side === "buy" ? "bg-pos/15" : "bg-neg/15"}`}
                style={{ width: `${Math.min(1, t.size / maxSize) * 100}%` }}
              />
              <span className="relative text-text-3">{formatClock(t.ts)}</span>
              <span className="relative text-right">{t.price.toFixed(2)}</span>
              <span className="relative text-right">{t.size.toFixed(3)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
