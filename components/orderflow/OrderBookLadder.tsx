"use client";

import { useEffect, useRef, useState } from "react";
import type { BookLevel, IcebergLevel, OrderBookState, VenueBook } from "@/lib/orderflow-data";

/** 그룹핑 배율 저장 키 — 기본 ×10(원장 최소틱보다 굵게 묶어 벽이 덜 반짝이게). */
const GROUP_MULTIPLIER_KEY = "orderflow-ladder-group";
const GROUP_MULTIPLIERS = [1, 10, 100, 1000] as const;
type GroupMultiplier = (typeof GROUP_MULTIPLIERS)[number];
const DEFAULT_GROUP_MULTIPLIER: GroupMultiplier = 10;

const VENUE_LABELS: Record<string, string> = {
  hyperliquid: "HL",
  "binance-depth": "BIN",
  "bybit-depth": "BYBIT",
};

// 3분할 뷰(거래소별 독립 컬럼) 표시 순서 — 사용자 요청: binance, bybit, hl.
const VENUE_ORDER = ["binance-depth", "bybit-depth", "hyperliquid"];

// 차트 위 COB 오버레이(OrderBookPrimitive, levels=20)와 동일하게 맞춤 — 백엔드
// VENUE_DEPTH_LEVELS=400 상한 이내라 그룹핑 배율(×100)에서도 20행 채울 raw 뎁스 확보.
const LEVELS = 20;

interface LadderRow {
  price: number;
  size: number;
  delta: number;
  sum: number;
  cumFrac: number;
}

// 표시 자릿수(formatLadderPrice와 동일 기준)보다 원장 틱이 더 촘촘한 거래소(예: 바이낸스 0.01)는
// 화면상 같은 가격으로 보이는 행이 여러 줄 반복돼 벽 크기를 한눈에 읽기 어렵다 — 표시 틱 단위로
// 먼저 합산해 가격당 한 행만 남긴다.
function displayTick(price: number): number {
  if (price >= 1000) return 0.1;
  if (price >= 1) return 0.01;
  return 0.0001;
}

// BTC 같은 고가 코인은 최소틱(0.1)만 묶어도 100ms마다 벽이 들쭉날쭉해 신호로 못 씀 — NQ 같은 선물과
// 달리 원장 틱이 훨씬 촘촘하기 때문. 사용자가 조정 가능한 그룹핑 배율(×1/×10/×100)을 최소틱에 곱해
// 실제로 보여줄 굵기를 정한다.
function aggregateByDisplayTick(levels: BookLevel[], sortDir: 1 | -1, groupMultiplier: number): BookLevel[] {
  const sums = new Map<number, number>();
  for (const lvl of levels) {
    const tick = displayTick(lvl.price) * groupMultiplier;
    const price = Math.round(lvl.price / tick) * tick;
    sums.set(price, (sums.get(price) ?? 0) + lvl.size);
  }
  return Array.from(sums, ([price, size]) => ({ price, size })).sort((a, b) => (a.price - b.price) * sortDir);
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

/** 실제 호가 래더 — 거래소별(binance/bybit/hl) 독립 컬럼 3분할. 풀링된 단일 래더 대신 각 거래소
 * 원장을 그대로 보여줘 더 깊은 뎁스 확보(반올림/합산으로 인한 정보 손실 없음). */
export function OrderBookLadder({ book, icebergLevels }: OrderBookLadderProps) {
  const icebergSet = new Set(icebergLevels.map((lv) => `${lv.side}:${lv.price}`));
  const [groupMultiplier, setGroupMultiplier] = useState<GroupMultiplier>(DEFAULT_GROUP_MULTIPLIER);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(GROUP_MULTIPLIER_KEY));
      if (GROUP_MULTIPLIERS.includes(stored as GroupMultiplier)) setGroupMultiplier(stored as GroupMultiplier);
    } catch {
      // localStorage 불가 환경에서는 기본 배율 유지.
    }
  }, []);

  function changeGroupMultiplier(next: GroupMultiplier) {
    setGroupMultiplier(next);
    try {
      window.localStorage.setItem(GROUP_MULTIPLIER_KEY, String(next));
    } catch {
      // localStorage 불가 환경에서는 세션 내 상태만 유지.
    }
  }

  return (
    <div className="flex flex-col h-full text-[10px] font-data border-l border-border">
      <div className="flex items-center justify-end gap-0.5 px-1.5 py-1 border-b border-border text-text-3 shrink-0">
        <span className="mr-1">묶음</span>
        {GROUP_MULTIPLIERS.map((m) => (
          <button
            key={m}
            type="button"
            title="가격 그룹핑 배율 — 클수록 벽이 덜 반짝이고 큰 흐름이 잘 보임"
            onClick={() => changeGroupMultiplier(m)}
            className={`px-1.5 py-0.5 border ${
              groupMultiplier === m ? "border-accent text-accent bg-accent/10" : "border-border bg-panel text-text-3"
            }`}
          >
            ×{m}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 flex-1 min-h-0 divide-x divide-border">
        {VENUE_ORDER.map((venueKey) => (
          <VenueColumn
            key={venueKey}
            venueKey={venueKey}
            venueBook={book.byVenue[venueKey] ?? EMPTY_VENUE_BOOK}
            connected={book.venues.includes(venueKey)}
            icebergSet={icebergSet}
            groupMultiplier={groupMultiplier}
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
  groupMultiplier,
}: {
  venueKey: string;
  venueBook: VenueBook;
  connected: boolean;
  icebergSet: Set<string>;
  groupMultiplier: number;
}) {
  const prevBidsRef = useRef<Map<number, number>>(new Map());
  const prevAsksRef = useRef<Map<number, number>>(new Map());
  const prevGroupMultiplierRef = useRef(groupMultiplier);
  const [bidRows, setBidRows] = useState<LadderRow[]>([]);
  const [askRows, setAskRows] = useState<LadderRow[]>([]);

  useEffect(() => {
    const bids = aggregateByDisplayTick(venueBook.bids, -1, groupMultiplier);
    const asks = aggregateByDisplayTick(venueBook.asks, 1, groupMultiplier);
    // 배율이 바뀌면 가격 키가 통째로 달라지므로 델타 추적(prevByPrice)을 초기화 — 아니면 옛 배율의
    // 가격으로 남은 항목과 매칭돼 엉뚱한 델타 하이라이트가 뜬다. 매 틱마다 리셋하면 델타 표시 자체가
    // 죽으므로 배율이 실제로 바뀐 순간에만 리셋.
    if (prevGroupMultiplierRef.current !== groupMultiplier) {
      prevBidsRef.current = new Map();
      prevAsksRef.current = new Map();
      prevGroupMultiplierRef.current = groupMultiplier;
    }
    const maxSum = Math.max(
      1,
      bids.slice(0, LEVELS).reduce((s, l) => s + l.size, 0),
      asks.slice(0, LEVELS).reduce((s, l) => s + l.size, 0)
    );
    setBidRows(buildRows(bids, prevBidsRef.current, maxSum));
    setAskRows(buildRows(asks, prevAsksRef.current, maxSum));
    prevBidsRef.current = new Map(bids.map((l) => [l.price, l.size]));
    prevAsksRef.current = new Map(asks.map((l) => [l.price, l.size]));
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
