"use client";

import { useEffect, useRef, useState } from "react";
import { getOptionsGex, type GexSnapshot } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

interface UseGexSnapshotResult {
  gex: GexSnapshot | null;
  isStale: boolean;
}

/** currency(BTC/ETH)의 스트라이크별 GEX 스냅샷을 60초마다 폴링. 실패 시 마지막 값 유지. */
export function useGexSnapshot(currency: string): UseGexSnapshotResult {
  const [gex, setGex] = useState<GexSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      getOptionsGex(currency, ctrl.signal)
        .then((snapshot) => {
          if (!cancelled) setGex(snapshot);
        })
        .catch(() => {
          // 일시적 폴링 실패는 조용히 무시 — 마지막 캐시값(gex)을 그대로 유지한다.
          // (백엔드 orderflow/gex.py의 _cache가 upstream 실패 시 마지막 값을 보존하는 것과 동일한 동작)
        });
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [currency]);

  const isStale = gex != null && Date.now() - gex.updated_at * 1000 > 5 * 60_000;

  return { gex, isStale };
}
