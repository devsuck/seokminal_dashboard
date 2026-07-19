"use client";

import { useEffect, useRef, useState } from "react";
import { getHLPositions, type HLAssetPosition, type HLOpenOrder } from "@/lib/api";

const POLL_INTERVAL_MS = 15_000;

export interface HLPositionSnapshot {
  position: HLAssetPosition["position"];
  paper: boolean;
}

interface UseHLPositionResult {
  positions: HLPositionSnapshot[];
  openOrders: (HLOpenOrder & { paper: boolean })[];
}

/** coin(HL 심볼)의 라이브+페이퍼 포지션/미체결주문을 15초마다 폴링 — 차트에 진입가/청산가/주문 인라인 표시용. */
export function useHLPosition(coin: string): UseHLPositionResult {
  const [positions, setPositions] = useState<HLPositionSnapshot[]>([]);
  const [openOrders, setOpenOrders] = useState<(HLOpenOrder & { paper: boolean })[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!coin) {
      setPositions([]);
      setOpenOrders([]);
      return;
    }
    let cancelled = false;

    function poll() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      Promise.all([getHLPositions(false, ctrl.signal), getHLPositions(true, ctrl.signal)])
        .then(([live, paper]) => {
          if (cancelled) return;
          const match = (c: string) => c.toUpperCase() === coin.toUpperCase();
          setPositions([
            ...live.asset_positions.filter((p) => match(p.position.coin)).map((p) => ({ position: p.position, paper: false })),
            ...paper.asset_positions.filter((p) => match(p.position.coin)).map((p) => ({ position: p.position, paper: true })),
          ]);
          setOpenOrders([
            ...live.open_orders.filter((o) => match(o.coin)).map((o) => ({ ...o, paper: false })),
            ...paper.open_orders.filter((o) => match(o.coin)).map((o) => ({ ...o, paper: true })),
          ]);
        })
        .catch(() => {
          // 일시적 폴링 실패는 조용히 무시 — 마지막 캐시값 유지.
        });
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [coin]);

  return { positions, openOrders };
}
