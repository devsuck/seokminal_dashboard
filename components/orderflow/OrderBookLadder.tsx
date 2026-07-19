"use client";

import { useEffect, useRef, useState } from "react";
import type { BookLevel, IcebergLevel, OrderBookState, VenueBook } from "@/lib/orderflow-data";

const VENUE_LABELS: Record<string, string> = {
  hyperliquid: "HL",
  "binance-depth": "BIN",
  "okx-depth": "OKX",
};

// 3분할 뷰(거래소별 독립 컬럼) 표시 순서 — 사용자 요청: binance, okx, hl.
const VENUE_ORDER = ["binance-depth", "okx-depth", "hyperliquid"];

// 풀링 뷰(LEVELS=14)보다 깊게 — 거래소별 원장은 반올림/합산 없는 raw 뎁스라 더 보여줘도 무방
// (백엔드 VENUE_DEPTH_LEVELS=30 상한 이내).
const LEVELS = 20;

interface LadderRow {
  price: number;
  size: number;
  delta: number;
  sum: number;
  cumFrac: number;
}

function buildRows(levels: BookLevel[], prevByPrice: Map<number, number>, maxSum: number): LadderRow[] {
  let cum = 0;
  return levels.slice(0, LEVELS).map((lvl) => {
    cum += lvl.size;
    const prevSize = prevByPrice.get(lvl.price) ?? 0;
    return {
      price: lvl.price,
      size: lvl.size,
      delta: lvl.size - prevSize,
      sum: cum,
      cumFrac: maxSum > 0 ? Math.min(1, cum / maxSum) : 0,
    };
  });
}

const EMPTY_VENUE_BOOK: VenueBook = { bids: [], asks: [] };

// 좁은 3분할 컬럼에서 가격이 잘리지 않게 자릿수를 가격대에 맞춰 압축(고가 코인일수록 소수점 줄임).
function formatLadderPrice(price: number): string {
  if (price >= 1000) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

interface OrderBookLadderProps {
  book: OrderBookState;
  icebergLevels: IcebergLevel[];
}

/** 실제 호가 래더 — 거래소별(binance/okx/hl) 독립 컬럼 3분할. 풀링된 단일 래더 대신 각 거래소
 * 원장을 그대로 보여줘 더 깊은 뎁스 확보(반올림/합산으로 인한 정보 손실 없음). */
export function OrderBookLadder({ book, icebergLevels }: OrderBookLadderProps) {
  const icebergSet = new Set(icebergLevels.map((lv) => `${lv.side}:${lv.price}`));
  return (
    <div className="flex flex-col h-full text-[10px] font-data border-l border-border">
      <div className="grid grid-cols-3 flex-1 min-h-0 divide-x divide-border">
        {VENUE_ORDER.map((venueKey) => (
          <VenueColumn
            key={venueKey}
            venueKey={venueKey}
            venueBook={book.byVenue[venueKey] ?? EMPTY_VENUE_BOOK}
            connected={book.venues.includes(venueKey)}
            icebergSet={icebergSet}
          />
        ))}
      </div>
    </div>
  );
}

function VenueColumn({
  venueKey,
  venueBook,
  connected,
  icebergSet,
}: {
  venueKey: string;
  venueBook: VenueBook;
  connected: boolean;
  icebergSet: Set<string>;
}) {
  const prevBidsRef = useRef<Map<number, number>>(new Map());
  const prevAsksRef = useRef<Map<number, number>>(new Map());
  const [bidRows, setBidRows] = useState<LadderRow[]>([]);
  const [askRows, setAskRows] = useState<LadderRow[]>([]);

  useEffect(() => {
    const maxSum = Math.max(
      1,
      venueBook.bids.slice(0, LEVELS).reduce((s, l) => s + l.size, 0),
      venueBook.asks.slice(0, LEVELS).reduce((s, l) => s + l.size, 0)
    );
    setBidRows(buildRows(venueBook.bids, prevBidsRef.current, maxSum));
    setAskRows(buildRows(venueBook.asks, prevAsksRef.current, maxSum));
    prevBidsRef.current = new Map(venueBook.bids.map((l) => [l.price, l.size]));
    prevAsksRef.current = new Map(venueBook.asks.map((l) => [l.price, l.size]));
  }, [venueBook]);

  const bestAsk = askRows.length > 0 ? askRows[askRows.length - 1] : null;
  const bestBid = bidRows.length > 0 ? bidRows[0] : null;
  const spread = bestAsk && bestBid ? bestAsk.price - bestBid.price : null;

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center justify-between px-1.5 py-1 border-b border-border text-text-3 shrink-0">
        <span className="text-text-2">{VENUE_LABELS[venueKey] ?? venueKey}</span>
        <span className={connected ? "text-pos" : "text-text-3"}>{connected ? "●" : "○"}</span>
      </div>
      <div className="grid grid-cols-[2.2fr_1fr_1.2fr] px-1.5 py-0.5 text-text-3 border-b border-border shrink-0">
        <span>가격</span>
        <span className="text-right">수량</span>
        <span className="text-right">누적</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse">
        {askRows.length === 0 ? (
          <div className="px-1.5 py-2 text-text-3">데이터 대기 중</div>
        ) : (
          [...askRows].reverse().map((row) => (
            <LadderRowView
              key={`ask-${row.price}`}
              row={row}
              side="ask"
              isIceberg={icebergSet.has(`ask:${row.price}`)}
            />
          ))
        )}
      </div>
      {spread !== null && (
        <div className="px-1.5 py-1 text-center text-text-2 border-y border-border bg-panel-2 shrink-0">
          {spread.toFixed(2)}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {bidRows.length === 0 ? (
          <div className="px-1.5 py-2 text-text-3">데이터 대기 중</div>
        ) : (
          bidRows.map((row) => (
            <LadderRowView
              key={`bid-${row.price}`}
              row={row}
              side="bid"
              isIceberg={icebergSet.has(`bid:${row.price}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LadderRowView({ row, side, isIceberg }: { row: LadderRow; side: "bid" | "ask"; isIceberg: boolean }) {
  const barColor = side === "bid" ? "bg-pos/20" : "bg-neg/20";
  const textColor = side === "bid" ? "text-pos" : "text-neg";
  const deltaColor = row.delta > 0 ? "text-pos" : row.delta < 0 ? "text-neg" : "text-text-1";
  return (
    <div
      className={`relative grid grid-cols-[2.2fr_1fr_1.2fr] px-1.5 py-[1px] overflow-hidden ${isIceberg ? "border border-warn/70" : ""}`}
    >
      <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ width: `${row.cumFrac * 100}%` }}>
        <div className={`h-full w-full ${barColor}`} />
      </div>
      <span className={`relative truncate ${textColor}`}>{formatLadderPrice(row.price)}</span>
      <span className={`relative text-right truncate ${deltaColor}`}>{row.size.toFixed(3)}</span>
      <span className="relative text-right text-text-3 truncate">{row.sum.toFixed(2)}</span>
    </div>
  );
}
