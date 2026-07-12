"use client";

import { useEffect, useRef, useState } from "react";
import { getHlFunding, type FundingSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

interface UseFundingSnapshotResult {
  funding: FundingSnapshot | null;
  isStale: boolean;
}

/** coin(HL 심볼)의 펀딩비+OI 스냅샷을 60초마다 폴링. 실패 시 마지막 값 유지. */
export function useFundingSnapshot(coin: string): UseFundingSnapshotResult {
  const [funding, setFunding] = useState<FundingSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      getHlFunding(coin, ctrl.signal)
        .then((snapshot) => {
          if (!cancelled) setFunding(snapshot);
        })
        .catch(() => {
          // 일시적 폴링 실패는 조용히 무시 — 마지막 캐시값(funding)을 그대로 유지한다.
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

  const isStale = funding != null && Date.now() - funding.updated_at * 1000 > 5 * 60_000;

  return { funding, isStale };
}
