"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings, getFxRate,
  type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding, type FxRate,
} from "@/lib/api";
import { LoadingState } from "@/components/ui";
import { ApLightHero } from "@/components/ui/ApPrimitives";

/* 자산군 요약(국내주식/해외주식/코인) — 상세 종목 리스트는 /portfolio가 담당.
   여기는 ApLightHero 하나(총액+자산군별 비중)와 링크로 축소. */

function fmt(v: number | null, ccy: string): string {
  if (v == null) return "—";
  const locale = ccy === "KRW" ? "ko-KR" : "en-US";
  const symbol = ccy === "KRW" ? "₩" : ccy === "USDC" ? "" : "$";
  const suffix = ccy === "USDC" ? " USDC" : "";
  return `${symbol}${v.toLocaleString(locale, { maximumFractionDigits: 0 })}${suffix}`;
}

interface WeightedPart { weight: number; pct: number }
/** 포지션별 return%/P&L%를 포지션 가치로 가중평균 — 계좌 레벨 return% 필드가 없는 벤더 대응 */
function weightedReturnPct(parts: WeightedPart[]): number | null {
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  if (!(totalWeight > 0)) return null;
  return parts.reduce((s, p) => s + p.pct * p.weight, 0) / totalWeight;
}

function pctLabel(p: number | null): string {
  return p == null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

export default function PortfolioTab() {
  const [krwHoldings, setKrwHoldings] = useState<KISHolding[]>([]);
  const [krwTotal, setKrwTotal] = useState<number | null>(null);
  const [alpacaAcct, setAlpacaAcct] = useState<AlpacaAccount | null>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [hlPositions, setHlPositions] = useState<HLAssetPosition[]>([]);
  const [usdcTotal, setUsdcTotal] = useState<number | null>(null);
  const [fx, setFx] = useState<FxRate | null>(null);
  const [fxError, setFxError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.allSettled([
      getAlpacaAccount(),
      getAlpacaPositions(),
      getPaperState(),
      getHLPositions(true),
      getHLPositions(false),
      getKisHoldings(true),
      getKisHoldings(false),
      getAccountBalances(),
      getFxRate(),
    ]).then(([acctRes, posRes, paperRes, hlTestRes, hlMainRes, kisMockRes, kisLiveRes, balRes, fxRes]) => {
      if (acctRes.status === "fulfilled") setAlpacaAcct(acctRes.value);
      if (posRes.status === "fulfilled") setAlpacaPositions(posRes.value);
      if (paperRes.status === "fulfilled") setPaper(paperRes.value);

      const hlAll = [
        ...(hlTestRes.status === "fulfilled" ? hlTestRes.value.asset_positions : []),
        ...(hlMainRes.status === "fulfilled" ? hlMainRes.value.asset_positions : []),
      ];
      setHlPositions(hlAll);

      const krwAll = [
        ...(kisMockRes.status === "fulfilled" ? kisMockRes.value.holdings : []),
        ...(kisLiveRes.status === "fulfilled" ? kisLiveRes.value.holdings : []),
      ];
      setKrwHoldings(krwAll);

      if (balRes.status === "fulfilled") {
        const krwAccounts = balRes.value.accounts.filter(a => a.ccy === "KRW");
        setKrwTotal(krwAccounts.every(a => a.balance == null) ? null
          : krwAccounts.reduce((s, a) => s + (a.balance ?? 0), 0));
        const usdcAccounts = balRes.value.accounts.filter(a => a.ccy === "USDC");
        setUsdcTotal(usdcAccounts.every(a => a.balance == null) ? null
          : usdcAccounts.reduce((s, a) => s + (a.balance ?? 0), 0));
      }

      if (fxRes.status === "fulfilled") { setFx(fxRes.value); setFxError(false); }
      else setFxError(true);

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <LoadingState message="포트폴리오 로딩 중…" hint="자산군별 보유내역 집계 — 5~10초 걸립니다" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
      </div>
    );
  }

  const lkgValue = paper ? paper.cash + paper.positions.reduce((s, p) => s + p.value, 0) : null;
  const usdValue = (alpacaAcct?.portfolio_value ?? 0) + (lkgValue ?? 0);
  const usdReturn = weightedReturnPct(
    alpacaPositions.map(p => ({ weight: p.market_value, pct: p.unrealized_plpc * 100 })),
  );

  const krwReturn = weightedReturnPct(
    krwHoldings.filter(h => h.return_pct != null).map(h => ({ weight: h.qty * h.current, pct: h.return_pct as number })),
  );

  const hlReturn = weightedReturnPct(
    hlPositions.map(p => ({
      weight: parseFloat(p.position.positionValue),
      pct: parseFloat(p.position.returnOnEquity) * 100,
    })),
  );

  const tiles = [
    { label: "국내주식", value: krwTotal, ccy: "KRW", returnPct: krwReturn },
    { label: "해외주식", value: usdValue, ccy: "USD", returnPct: usdReturn },
    { label: "코인", value: usdcTotal, ccy: "USDC", returnPct: hlReturn },
  ];

  // KRW/USD/USDC 잔고를 USD로 환산한 총액 — 히어로 카드 상단 값
  const usdkrw = fx?.usdkrw ?? null;
  const totalUsdEquiv = usdkrw != null && usdkrw > 0
    ? (krwTotal ?? 0) / usdkrw + usdValue + (usdcTotal ?? 0)
    : null;
  const heroValue = totalUsdEquiv != null
    ? `$${totalUsdEquiv.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "—";
  const missingClass = tiles.some(t => t.value == null);
  const heroRows = tiles.map(t => ({
    label: t.label,
    value: `${fmt(t.value, t.ccy)} ${pctLabel(t.returnPct)}`,
    cls: t.returnPct == null ? undefined : t.returnPct >= 0 ? "text-ap-up" : "text-ap-down",
  }));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-3">
      <h1 className="text-xl font-semibold text-ap-ink-1 tracking-wide">총 포트폴리오</h1>
      <ApLightHero
        label="USD 환산 총액"
        value={heroValue}
        sub={missingClass ? "일부 자산군 조회 실패 — 총액 과소 표시" : fxError ? "환율 조회 실패 — 자산군별 개별 표시" : undefined}
        rows={heroRows}
      />
      <Link href="/portfolio"
        className="block text-center text-[13px] text-ap-ink-3 hover:text-ap-ink-1 no-underline py-1">
        포트폴리오 상세 보기 →
      </Link>
    </div>
  );
}
