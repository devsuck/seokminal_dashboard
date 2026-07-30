"use client";

import type { FundingSnapshot } from "@/lib/api";

const STALE_THRESHOLD_MS = 5 * 60_000;
const HOURS_PER_YEAR = 24 * 365;

interface FundingPanelProps {
  coin: string;
  funding: FundingSnapshot | null;
}

// HL은 1시간마다 funding 정산 — 연율화 = funding * 24 * 365 * 100(%).
export function FundingPanel({ coin, funding }: FundingPanelProps) {
  const isStale = funding != null && Date.now() - funding.updated_at * 1000 > STALE_THRESHOLD_MS;
  const dayChangePct =
    funding && funding.prev_day_px > 0
      ? ((funding.mark_px - funding.prev_day_px) / funding.prev_day_px) * 100
      : null;
  const annualizedPct = funding ? funding.funding * HOURS_PER_YEAR * 100 : null;

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-text-1 text-sm font-medium">{coin} 펀딩비 · OI</h3>
        <span className="text-text-3 text-xs">
          {funding ? `마크가 ${funding.mark_px.toLocaleString()}` : "로딩 중"}
          {isStale && <span className="text-warn"> · 데이터 지연</span>}
        </span>
      </div>
      {funding && (
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-text-3">펀딩비(1h)</div>
            <div className={funding.funding >= 0 ? "text-pos" : "text-neg"}>
              {(funding.funding * 100).toFixed(4)}%
            </div>
          </div>
          <div>
            <div className="text-text-3">연율화</div>
            <div className={annualizedPct !== null && annualizedPct >= 0 ? "text-pos" : "text-neg"}>
              {annualizedPct !== null ? `${annualizedPct.toFixed(1)}%` : "-"}
            </div>
          </div>
          <div>
            <div className="text-text-3">미결제약정</div>
            <div className="text-text-1">
              {funding.open_interest.toLocaleString()} {coin}
            </div>
          </div>
          <div>
            <div className="text-text-3">전일 대비</div>
            <div className={dayChangePct !== null && dayChangePct >= 0 ? "text-pos" : "text-neg"}>
              {dayChangePct !== null ? `${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%` : "-"}
            </div>
          </div>
        </div>
      )}
      <p className="text-text-3 text-[11px]">
        차트 위 청산 레벨(레버리지 3/5/10/20/40x 점선)은 OI+funding 기반 추정치이며, 실제 청산 데이터가 아닙니다.
      </p>
    </div>
  );
}
