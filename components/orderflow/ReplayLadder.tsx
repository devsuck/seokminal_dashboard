import type { OrderflowHistorySnapshot } from "@/lib/api";

const LEVELS = 15;

function formatLadderPrice(price: number): string {
  return price >= 1 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price.toPrecision(4);
}

/** 저장된 스냅샷 하나를 렌더링하는 단일 컬럼 래더 — 저장 시 거래소별 원장(byVenue)은
 * 남기지 않으므로(용량 절약) OrderBookLadder(라이브, 3분할)와 달리 풀링된 단일 뷰만 제공한다. */
export function ReplayLadder({ snapshot }: { snapshot: OrderflowHistorySnapshot | null }) {
  if (!snapshot) {
    return <div className="flex items-center justify-center h-full text-text-3 text-xs">데이터 없음</div>;
  }
  const bids = snapshot.bids.slice(0, LEVELS);
  const asks = snapshot.asks.slice(0, LEVELS);
  const maxSize = Math.max(1, ...bids.map((b) => b[1]), ...asks.map((a) => a[1]));
  const bestBid = bids[0]?.[0] ?? null;
  const bestAsk = asks[0]?.[0] ?? null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return (
    <div className="flex flex-col h-full text-[10px] font-data">
      <div className="grid grid-cols-2 px-1.5 py-0.5 text-text-3 border-b border-border shrink-0">
        <span>가격</span>
        <span className="text-right">수량</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-end">
        {[...asks].reverse().map(([price, size]) => (
          <Row key={`ask-${price}`} price={price} size={size} side="ask" frac={size / maxSize} />
        ))}
      </div>
      {spread !== null && (
        <div className="px-1.5 py-1 text-center text-text-2 border-y border-border bg-panel-2 shrink-0">
          {spread.toFixed(2)}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {bids.map(([price, size]) => (
          <Row key={`bid-${price}`} price={price} size={size} side="bid" frac={size / maxSize} />
        ))}
      </div>
    </div>
  );
}

function Row({ price, size, side, frac }: { price: number; size: number; side: "bid" | "ask"; frac: number }) {
  const barColor = side === "bid" ? "bg-pos/20" : "bg-neg/20";
  const textColor = side === "bid" ? "text-pos" : "text-neg";
  return (
    <div className="relative grid grid-cols-2 px-1.5 py-[1px] overflow-hidden">
      <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ width: `${frac * 100}%` }}>
        <div className={`h-full w-full ${barColor}`} />
      </div>
      <span className={`relative truncate ${textColor}`}>{formatLadderPrice(price)}</span>
      <span className="relative text-right truncate text-text-1">{size.toFixed(3)}</span>
    </div>
  );
}
