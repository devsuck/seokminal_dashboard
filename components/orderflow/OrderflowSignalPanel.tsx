"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CompositeValueArea,
  IcebergLevel,
  LargeTrade,
  SessionLevels,
  SpoofAlert,
  TpoLevel,
  ValueArea,
} from "@/lib/orderflow-data";
import { CATEGORICAL } from "@/lib/chart-colors";

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
  divergenceMarkers: MarkerEvent[];
  /** 스푸핑 의심 휴리스틱 알림 — L2 스냅샷 패턴 매칭일 뿐 order-id 기반 실제 스푸핑 탐지 아님, 항상 낮은 신뢰도로 표기. */
  spoofAlerts: SpoofAlert[];
  valueArea: ValueArea | null;
  /** 여러 UTC 세션(일자) 합성 POC/VA — 세션 2개 미만 확보 시(버퍼가 자정을 안 걸침) null. */
  compositeValueArea: CompositeValueArea | null;
  /** TPO(마켓프로파일) 가격별 구간 리스트 — 체결량이 아니라 "몇 개 30분 구간에서 찍혔는가" 기준. */
  tpoLevels: TpoLevel[];
  /** TPO 기준 POC/VAH/VAL — 거래량 프로파일(valueArea)과는 다른 축이라 별도 표기. */
  tpoValueArea: ValueArea | null;
  sessionLevels: SessionLevels | null;
  /** 세션 VWAP 마지막 값 — 레벨 판독용. */
  vwapLast: number | null;
  /** 현재가(마지막 종가) — 각 레벨과의 위/아래 관계 표기용. */
  lastPrice: number | null;
  /** 체결속도(건/초, 최근 10초 롤링) — 백엔드 aggregator 계산값, 첫 실체결 도착 전엔 null. */
  tapeSpeed: number | null;
  /** 대량체결 트래커 워밍업(표본 20건) 완료 여부 — 미완료 시 파생 시그널은 아직 침묵 상태. */
  warmedUp: boolean;
}

type FeedEvent =
  | { kind: "absorption"; time: number; side: "buy" | "sell" }
  | { kind: "stopRun"; time: number; side: "buy" | "sell" }
  | { kind: "divergence"; time: number; side: "buy" | "sell" }
  | { kind: "largeTrade"; time: number; side: "buy" | "sell"; price: number; size: number }
  | { kind: "spoof"; time: number; side: "bid" | "ask"; price: number; peakSize: number; note: string };

const FEED_MAX = 14;
/** 활용 가이드 최초 1회 자동 펼침 여부 저장 키 — 처음엔 가르쳐주고, 닫으면 그 뒤로 기본 접힘. */
const GUIDE_SEEN_KEY = "orderflow-guide-seen";
/** TPO 래더에 표시할 최대 가격행 수 — POC 중심으로 위아래 잘라서 스크롤 없이 훑어볼 정도만. */
const TPO_ROW_MAX = 14;
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
  divergenceMarkers,
  spoofAlerts,
  valueArea,
  compositeValueArea,
  tpoLevels,
  tpoValueArea,
  sessionLevels,
  vwapLast,
  lastPrice,
  tapeSpeed,
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

  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(GUIDE_SEEN_KEY) === "1";
    } catch {
      // localStorage 불가 환경에서는 매번 펼침 상태로 시작.
    }
    setGuideOpen(!seen);
  }, []);

  const feed = useMemo<FeedEvent[]>(() => {
    const events: FeedEvent[] = [
      ...absorptionMarkers.map((m) => ({ kind: "absorption" as const, time: m.time, side: m.side })),
      ...stopRunMarkers.map((m) => ({ kind: "stopRun" as const, time: m.time, side: m.side })),
      ...divergenceMarkers.map((m) => ({ kind: "divergence" as const, time: m.time, side: m.side })),
      ...largeTrades.map((t) => ({
        kind: "largeTrade" as const,
        time: t.bucketTs,
        side: t.side,
        price: t.price,
        size: t.size,
      })),
      ...spoofAlerts.map((a) => ({
        kind: "spoof" as const,
        time: a.ts,
        side: a.side,
        price: a.price,
        peakSize: a.peakSize,
        note: a.note,
      })),
    ];
    return events.sort((a, b) => b.time - a.time).slice(0, FEED_MAX);
  }, [absorptionMarkers, stopRunMarkers, divergenceMarkers, largeTrades, spoofAlerts]);

  // 숫자 6~7개를 조합해서 읽어야 했던 걸 한 줄 판단으로 압축 — 라이브로 지켜볼 때 바로 읽히게.
  // 흡수/스탑런/다이버전스 같은 파생 이벤트만 워밍업 게이팅 — bias 자체(호가+체결+CVD)는 워밍업과 무관하게 바로 값이 있음.
  const headline = useMemo<string | null>(() => {
    if (!bias) return null;
    if (bias.label !== "매수 우위" && bias.label !== "매도 우위") {
      return "방향성 혼조 — POC/VWAP 근처 회귀매매 관점이 더 맞는 국면";
    }
    const dir = bias.label === "매수 우위" ? "매수" : "매도";
    const agree = (bias.label === "매수 우위" && cvdSlope > 0) || (bias.label === "매도 우위" && cvdSlope < 0);
    const latest = feed.find((ev) => ev.kind === "absorption" || ev.kind === "stopRun" || ev.kind === "divergence");
    let latestNote = "";
    if (latest?.kind === "absorption") latestNote = " · 최근 흡수 이벤트 — 반대편 물량 주시";
    else if (latest?.kind === "stopRun") latestNote = " · 최근 스탑런 — 되돌림 후보 구간";
    else if (latest?.kind === "divergence") latestNote = " · 최근 델타 다이버전스 — 약한 극값 가능";
    return `${dir} 쪽 힘 쏠림, CVD ${agree ? "동의" : "비동의"} — ${
      agree ? "추세 지속 관점" : "신뢰도 낮음, 되돌림 주의"
    }${latestNote}`;
  }, [warmedUp, bias, cvdSlope, feed]);

  return (
    <div className="text-xs">
      <Section title="종합 편향 (호가 + 체결 + CVD 합의)">
        {bias ? (
          <>
            <div className={`text-base font-data ${bias.tone}`}>{bias.label}</div>
            {headline && <div className="mt-1 text-[11px] text-text-2 leading-relaxed">{headline}</div>}
            {!warmedUp && (
              <div className="mt-1 text-[10px] text-text-3">
                흡수/스탑런/아이스버그 워밍업 중 — 체결 표본 수집 (20건 필요)
              </div>
            )}
          </>
        ) : (
          <div className="text-text-3">데이터 대기 중</div>
        )}
        <div
          className="mt-1.5 text-[11px] text-text-3"
          title="최근 10초 롤링 체결 건수/초 — 체결이 뜸해지면 다음 체결이 올 때까지 값이 안 내려가는 근사치"
        >
          체결속도{" "}
          <span className="font-data text-text-1">
            {tapeSpeed !== null ? `${tapeSpeed.toFixed(1)}건/초` : "—"}
          </span>
        </div>
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

      <Section title="주요 레벨 (현재가 대비)">
        {(() => {
          const rows: { label: string; price: number; tone?: string }[] = [];
          if (vwapLast !== null) rows.push({ label: "VWAP", price: vwapLast, tone: "text-warn" });
          if (valueArea) {
            rows.push({ label: "POC", price: valueArea.poc, tone: "text-accent" });
            rows.push({ label: "VAH", price: valueArea.vah });
            rows.push({ label: "VAL", price: valueArea.val });
          }
          if (compositeValueArea) {
            rows.push({ label: `cPOC(${compositeValueArea.sessionCount}일)`, price: compositeValueArea.poc, tone: "text-info" });
            rows.push({ label: "cVAH", price: compositeValueArea.vah });
            rows.push({ label: "cVAL", price: compositeValueArea.val });
          }
          if (sessionLevels) {
            rows.push({ label: "금일 고가", price: sessionLevels.sessionHigh });
            rows.push({ label: "금일 저가", price: sessionLevels.sessionLow });
            if (sessionLevels.prevHigh !== null) rows.push({ label: "전일 고가", price: sessionLevels.prevHigh });
            if (sessionLevels.prevLow !== null) rows.push({ label: "전일 저가", price: sessionLevels.prevLow });
          }
          if (rows.length === 0) return <div className="text-text-3">데이터 대기 중</div>;
          rows.sort((a, b) => b.price - a.price);
          return (
            <ul className="space-y-0.5">
              {rows.map((r) => (
                <li key={r.label} className="flex justify-between font-data">
                  <span className={r.tone ?? "text-text-2"}>{r.label}</span>
                  <span className="flex gap-1.5">
                    <span className="text-text-1">{formatPrice(r.price)}</span>
                    {lastPrice !== null && (
                      <span className={lastPrice >= r.price ? "text-pos" : "text-neg"}>
                        {lastPrice >= r.price ? "▼아래" : "▲위"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          );
        })()}
      </Section>

      <Section title="마켓프로파일 (TPO, 30분 단위)">
        {tpoLevels.length === 0 ? (
          <div className="text-text-3">데이터 대기 중</div>
        ) : (
          (() => {
            const pocPrice = tpoValueArea?.poc ?? null;
            const pocIdx = pocPrice !== null ? tpoLevels.findIndex((l) => l.price === pocPrice) : -1;
            let rows = tpoLevels;
            if (tpoLevels.length > TPO_ROW_MAX) {
              const center = pocIdx >= 0 ? pocIdx : Math.floor(tpoLevels.length / 2);
              const half = Math.floor(TPO_ROW_MAX / 2);
              const start = Math.min(Math.max(center - half, 0), tpoLevels.length - TPO_ROW_MAX);
              rows = tpoLevels.slice(start, start + TPO_ROW_MAX);
            }
            return (
              <ul className="space-y-0.5" title="같은 가격이 몇 개의 30분 구간에서 찍혔는지를 문자(A,B,C…)로 누적 표기 — 체결량이 아니라 '시간에 걸쳐 얼마나 자주 이 가격에서 거래됐는가' 기준의 분포">
                {rows.map((lv) => {
                  const isPoc = tpoValueArea?.poc === lv.price;
                  const inVa = tpoValueArea ? lv.price <= tpoValueArea.vah && lv.price >= tpoValueArea.val : false;
                  return (
                    <li key={lv.price} className="flex gap-2 font-data">
                      <span className={isPoc ? "text-accent" : inVa ? "text-text-2" : "text-text-3"}>
                        {formatPrice(lv.price)}
                      </span>
                      <span className={`truncate ${isPoc ? "text-accent" : "text-text-3"}`}>{lv.letters}</span>
                    </li>
                  );
                })}
              </ul>
            );
          })()
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
                {ev.kind === "divergence" && (
                  <span style={{ color: CATEGORICAL[0] }} title="신고/신저가인데 캔들 델타가 반대 — 약한 고점/저점">
                    다이버전스 · {ev.side === "buy" ? "신저가+매수 델타" : "신고가+매도 델타"}
                  </span>
                )}
                {ev.kind === "largeTrade" && (
                  <span className={ev.side === "buy" ? "text-pos" : "text-neg"}>
                    대량 {ev.side === "buy" ? "매수" : "매도"} {ev.size.toFixed(2)} @ {formatPrice(ev.price)}
                  </span>
                )}
                {ev.kind === "spoof" && (
                  <span className="text-warn" title={ev.note}>
                    스푸핑 의심(낮은 신뢰도) · {ev.side === "bid" ? "매수벽" : "매도벽"} {formatPrice(ev.price)} (피크{" "}
                    {ev.peakSize.toFixed(2)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <details
        className="px-3 py-2.5"
        open={guideOpen}
        onToggle={(e) => {
          const isOpen = e.currentTarget.open;
          setGuideOpen(isOpen);
          if (!isOpen) {
            try {
              window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
            } catch {
              // localStorage 불가 환경 — 다음 방문 시 다시 펼쳐짐, 기능상 문제 없음.
            }
          }
        }}
      >
        <summary className="text-[11px] text-text-3 cursor-pointer">활용 가이드 (처음이면 펼쳐서 읽기)</summary>
        <ul className="mt-2 space-y-1.5 text-[11px] text-text-2 leading-relaxed">
          <li>· 종합 편향이 한쪽 우위 + CVD 같은 방향이면 추세 지속 가능성.</li>
          <li>· 호가는 매수 우세인데 체결이 매도 우세면 매수벽 소진 여부 주시 (흡수 이벤트 확인).</li>
          <li>· 아이스버그 매수벽은 지지, 매도벽은 저항 후보 — 가격이 그 레벨에 접근할 때 반응 관찰.</li>
          <li>· 스탑런 직후 되돌림은 역추세 진입 후보, 단 대량체결이 같은 방향으로 이어지면 무효.</li>
          <li>· 가격이 VA(VAH~VAL) 안이면 POC 회귀 성향, 밖에서 안 돌아오면 추세 지속.</li>
          <li>· VWAP -1σ~-2σ 매수 되돌림 / +1σ~+2σ 매도 되돌림이 기본 프레임, 편향과 결합해서 판단.</li>
          <li>· 다이버전스는 세션 고저·전일 고저 근처에서 떴을 때 신뢰도 높음.</li>
          <li>· 워밍업(체결 20건) 전에는 아이스버그/스탑런/대량체결이 의도적으로 침묵.</li>
          <li>· 스푸핑 의심은 L2 스냅샷 패턴 매칭일 뿐 order-id 기반 탐지가 아님 — 참고 신호로만, 단독 판단 근거로 쓰지 말 것.</li>
        </ul>
      </details>
    </div>
  );
}
