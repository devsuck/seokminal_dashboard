"use client";

import { useMemo } from "react";
import type { IcebergLevel, LargeTrade } from "@/lib/orderflow-data";

interface MarkerEvent {
  time: number;
  side: "buy" | "sell";
}

interface OrderflowSignalPanelProps {
  imbalance: { bookBidPct: number; volBuyPct: number } | null;
  icebergLevels: IcebergLevel[];
  cvdSeries: { time: number; value: number }[];
  largeTrades: LargeTrade[];
  absorptionMarkers: MarkerEvent[];
  stopRunMarkers: MarkerEvent[];
  /** 대량체결 트래커 워밍업(표본 20건) 완료 여부 — 미완료 시 파생 시그널은 아직 침묵 상태. */
  warmedUp: boolean;
}

type FeedEvent =
  | { kind: "absorption"; time: number; side: "buy" | "sell" }
  | { kind: "stopRun"; time: number; side: "buy" | "sell" }
  | { kind: "largeTrade"; time: number; side: "buy" | "sell"; price: number; size: number };

const FEED_MAX = 14;
/** CVD 기울기 판정 시 비교할 과거 버킷 수 (1분봉 기준 10분 전 대비). */
const CVD_SLOPE_LOOKBACK = 10;

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-GB", { hour12: false });
}

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function pctTone(pct: number): string {
  if (pct >= 0.55) return "text-pos";
  if (pct <= 0.45) return "text-neg";
  return "text-text-2";
}

function Gauge({ label, pct, hint }: { label: string; pct: number; hint: string }) {
  return (
    <div title={hint}>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-text-3">{label}</span>
        <span className={`font-data ${pctTone(pct)}`}>매수 {Math.round(pct * 100)}%</span>
      </div>
      <div className="h-1.5 bg-neg/40">
        <div className="h-full bg-pos/70" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-border">
      <div className="text-[11px] text-text-3 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

export function OrderflowSignalPanel({
  imbalance,
  icebergLevels,
  cvdSeries,
  largeTrades,
  absorptionMarkers,
  stopRunMarkers,
  warmedUp,
}: OrderflowSignalPanelProps) {
  const cvdLast = cvdSeries.length > 0 ? cvdSeries[cvdSeries.length - 1].value : null;
  const cvdPrev =
    cvdSeries.length > CVD_SLOPE_LOOKBACK
      ? cvdSeries[cvdSeries.length - 1 - CVD_SLOPE_LOOKBACK].value
      : cvdSeries.length > 0
        ? cvdSeries[0].value
        : null;
  const cvdSlope = cvdLast !== null && cvdPrev !== null ? cvdLast - cvdPrev : 0;

  // 호가/체결/CVD 세 신호의 방향 합의로 종합 편향 판정 — 2개 이상 같은 방향일 때만 우위 표기.
  const bias = useMemo(() => {
    if (!imbalance) return null;
    let score = 0;
    if (imbalance.bookBidPct >= 0.55) score += 1;
    if (imbalance.bookBidPct <= 0.45) score -= 1;
    if (imbalance.volBuyPct >= 0.55) score += 1;
    if (imbalance.volBuyPct <= 0.45) score -= 1;
    if (cvdSlope > 0) score += 1;
    if (cvdSlope < 0) score -= 1;
    if (score >= 2) return { label: "매수 우위", tone: "text-pos" };
    if (score <= -2) return { label: "매도 우위", tone: "text-neg" };
    return { label: "중립 · 혼조", tone: "text-text-2" };
  }, [imbalance, cvdSlope]);

  const feed = useMemo<FeedEvent[]>(() => {
    const events: FeedEvent[] = [
      ...absorptionMarkers.map((m) => ({ kind: "absorption" as const, time: m.time, side: m.side })),
      ...stopRunMarkers.map((m) => ({ kind: "stopRun" as const, time: m.time, side: m.side })),
      ...largeTrades.map((t) => ({
        kind: "largeTrade" as const,
        time: t.bucketTs,
        side: t.side,
        price: t.price,
        size: t.size,
      })),
    ];
    return events.sort((a, b) => b.time - a.time).slice(0, FEED_MAX);
  }, [absorptionMarkers, stopRunMarkers, largeTrades]);

  return (
    <div className="text-xs">
      <Section title="종합 편향 (호가 + 체결 + CVD 합의)">
        {!warmedUp ? (
          <div className="text-text-3">워밍업 중 — 체결 표본 수집 (20건 필요)</div>
        ) : bias ? (
          <div className={`text-base font-data ${bias.tone}`}>{bias.label}</div>
        ) : (
          <div className="text-text-3">데이터 대기 중</div>
        )}
      </Section>

      <Section title="수급 임밸런스">
        {imbalance ? (
          <div className="space-y-2">
            <Gauge
              label="호가 잔량 (대기 물량)"
              pct={imbalance.bookBidPct}
              hint="오더북 매수호가 잔량 ÷ 전체 잔량 — 55% 이상이면 매수벽 우세"
            />
            <Gauge
              label="최근 체결 (실제 공격)"
              pct={imbalance.volBuyPct}
              hint="최근 200건 체결 중 매수 테이커 비율 — 실제로 시장가로 사는 쪽"
            />
          </div>
        ) : (
          <div className="text-text-3">데이터 대기 중</div>
        )}
      </Section>

      <Section title="CVD 누적 체결 델타">
        {cvdLast !== null ? (
          <div className="flex items-baseline gap-2">
            <span className={`font-data text-sm ${cvdLast >= 0 ? "text-pos" : "text-neg"}`}>
              {cvdLast >= 0 ? "+" : ""}
              {cvdLast.toFixed(2)}
            </span>
            <span
              className={`text-[11px] ${cvdSlope > 0 ? "text-pos" : cvdSlope < 0 ? "text-neg" : "text-text-3"}`}
              title={`최근 ${CVD_SLOPE_LOOKBACK}봉 변화 — 상승이면 매수 공격이 계속 우세`}
            >
              {cvdSlope > 0 ? "▲ 상승" : cvdSlope < 0 ? "▼ 하락" : "— 보합"} ({cvdSlope >= 0 ? "+" : ""}
              {cvdSlope.toFixed(2)})
            </span>
          </div>
        ) : (
          <div className="text-text-3">데이터 대기 중</div>
        )}
      </Section>

      <Section title="아이스버그 의심 레벨">
        {!warmedUp ? (
          <div className="text-text-3">워밍업 중</div>
        ) : icebergLevels.length === 0 ? (
          <div className="text-text-3">감지 없음</div>
        ) : (
          <ul className="space-y-1">
            {icebergLevels.map((lv) => (
              <li
                key={`${lv.side}:${lv.price}`}
                className="flex justify-between font-data"
                title="이 가격에서 누적 체결량이 현재 호가 잔량의 5배 이상 — 반복 리필되는 숨은 물량 추정"
              >
                <span className={lv.side === "bid" ? "text-pos" : "text-neg"}>
                  {lv.side === "bid" ? "매수벽" : "매도벽"} {formatPrice(lv.price)}
                </span>
                <span className="text-warn">×{lv.ratio.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="이벤트 피드">
        {feed.length === 0 ? (
          <div className="text-text-3">이벤트 없음</div>
        ) : (
          <ul className="space-y-1">
            {feed.map((ev, i) => (
              <li key={`${ev.kind}-${ev.time}-${i}`} className="flex gap-2 items-baseline">
                <span className="text-text-3 font-data shrink-0">{formatTime(ev.time)}</span>
                {ev.kind === "absorption" && (
                  <span className="text-info" title="우세 물량이 가격을 못 밀어냄 — 반대편 수동 물량이 흡수">
                    흡수 · {ev.side === "buy" ? "매도세 흡수됨" : "매수세 흡수됨"}
                  </span>
                )}
                {ev.kind === "stopRun" && (
                  <span className="text-warn" title="고/저점 이탈 후 반전 마감 — 손절 사냥 후 되돌림 가능성">
                    스탑런 · {ev.side === "buy" ? "하방 이탈 후 반등" : "상방 이탈 후 반락"}
                  </span>
                )}
                {ev.kind === "largeTrade" && (
                  <span className={ev.side === "buy" ? "text-pos" : "text-neg"}>
                    대량 {ev.side === "buy" ? "매수" : "매도"} {ev.size.toFixed(2)} @ {formatPrice(ev.price)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <details className="px-3 py-2.5">
        <summary className="text-[11px] text-text-3 cursor-pointer">활용 가이드</summary>
        <ul className="mt-2 space-y-1.5 text-[11px] text-text-2 leading-relaxed">
          <li>· 종합 편향이 한쪽 우위 + CVD 같은 방향이면 추세 지속 가능성.</li>
          <li>· 호가는 매수 우세인데 체결이 매도 우세면 매수벽 소진 여부 주시 (흡수 이벤트 확인).</li>
          <li>· 아이스버그 매수벽은 지지, 매도벽은 저항 후보 — 가격이 그 레벨에 접근할 때 반응 관찰.</li>
          <li>· 스탑런 직후 되돌림은 역추세 진입 후보, 단 대량체결이 같은 방향으로 이어지면 무효.</li>
          <li>· 워밍업(체결 20건) 전에는 아이스버그/스탑런/대량체결이 의도적으로 침묵.</li>
        </ul>
      </details>
    </div>
  );
}
