"use client";

import type { GexSnapshot } from "@/lib/api";
import { useOptionsFlowSocket } from "@/hooks/useOptionsFlowSocket";

const STALE_THRESHOLD_MS = 5 * 60_000;

interface OptionsFlowPanelProps {
  currency: string; // "BTC" | "ETH"
  gex: GexSnapshot | null;
}

// GEX 강도(감마 월 등)는 메인 차트 위 GexLevelsPrimitive 스트라이크 라인으로 이미 표시됨 —
// 여기서는 중복 바 차트 없이 스팟/체결 정보만 보여준다.
export function OptionsFlowPanel({ currency, gex }: OptionsFlowPanelProps) {
  const isStale = gex != null && Date.now() - gex.updated_at * 1000 > STALE_THRESHOLD_MS;
  const { trades, connectionState } = useOptionsFlowSocket(currency);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-text-1 text-sm font-medium">{currency} 옵션 GEX</h3>
        <span className="text-text-3 text-xs">
          {gex ? `spot ${gex.spot.toLocaleString()}` : "로딩 중"}
          {isStale && <span className="text-warn"> · 데이터 지연</span>}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-text-2 text-xs">옵션 체결</h4>
          <span className="text-text-3 text-xs">{connectionState}</span>
        </div>
        <div className="max-h-40 overflow-y-auto space-y-1">
          {trades.length === 0 && <div className="text-text-3 text-xs">체결 대기 중</div>}
          {trades.map((t, i) => (
            <div key={`${t.instrument_name}-${t.timestamp}-${i}`} className="flex items-center justify-between text-xs">
              <span className="text-text-2">{t.instrument_name}</span>
              <span className={t.direction === "buy" ? "text-pos" : "text-neg"}>
                {t.direction === "buy" ? "매수" : "매도"} {t.amount}
              </span>
              <span className="text-text-3">IV {t.iv.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
