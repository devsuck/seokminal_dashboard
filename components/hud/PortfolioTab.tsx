"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getDashboardPnlAll,
  type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type DashboardBotRow,
} from "@/lib/api";
import { LoadingState } from "@/components/ui";
import { BarChart, type BarItem } from "@/components/charts/BarChart";

/* 자산군 4타일 요약(국내주식/해외주식/코인/폴리마켓) — 에이전트 전부 미가동 상태라
   에이전트 중심 뷰(listAgents) 대신 실제 보유자산 기준으로 재작성. 상세 종목 리스트는
   여기 안 넣음(그건 /portfolio가 이미 함) — 타일은 합계·수익률만. */

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
  if (totalWeight <= 0) return null;
  return parts.reduce((s, p) => s + p.pct * p.weight, 0) / totalWeight;
}

function pctLabel(p: number | null): string {
  return p == null ? "—" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

interface AssetTileData {
  label: string;
  value: number | null;
  ccy: string;
  returnPct: number | null;
  href: string;
}

function AssetTile({ data }: { data: AssetTileData }) {
  const pos = data.returnPct != null && data.returnPct >= 0;
  return (
    <Link href={data.href}
      className="block bg-ap-surface border border-ap-line rounded-xl p-4 no-underline hover:border-ap-ink-3 transition-colors">
      <p className="text-ap-ink-3 text-[10px] uppercase tracking-wide">{data.label}</p>
      <p className="text-ap-ink-1 text-xl font-mono font-bold mt-1">{fmt(data.value, data.ccy)}</p>
      <p className={`text-xs font-mono mt-1 ${data.returnPct == null ? "text-ap-ink-3" : pos ? "text-ap-up" : "text-ap-down"}`}>
        {pctLabel(data.returnPct)}
      </p>
    </Link>
  );
}

export default function PortfolioTab() {
  const [krwHoldings, setKrwHoldings] = useState<KISHolding[]>([]);
  const [krwTotal, setKrwTotal] = useState<number | null>(null);
  const [alpacaAcct, setAlpacaAcct] = useState<AlpacaAccount | null>(null);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [hlPositions, setHlPositions] = useState<HLAssetPosition[]>([]);
  const [usdcTotal, setUsdcTotal] = useState<number | null>(null);
  const [polymarketBots, setPolymarketBots] = useState<DashboardBotRow[]>([]);
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
      getDashboardPnlAll(),
    ]).then(([acctRes, posRes, paperRes, hlTestRes, hlMainRes, kisMockRes, kisLiveRes, balRes, pnlRes]) => {
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

      if (pnlRes.status === "fulfilled") {
        setPolymarketBots(pnlRes.value.bots.filter(b => b.id.startsWith("polymarket")));
      }

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
      <div className="p-6 max-w-4xl mx-auto">
        <LoadingState message="포트폴리오 로딩 중…" hint="자산군별 보유내역 집계 — 5~10초 걸립니다" />
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

  const polymarketTotal = polymarketBots.length > 0
    ? polymarketBots.reduce((s, b) => s + (b.realized_pnl ?? 0), 0)
    : null;

  const tiles: AssetTileData[] = [
    { label: "국내주식", value: krwTotal, ccy: "KRW", returnPct: krwReturn, href: "/portfolio" },
    { label: "해외주식", value: usdValue, ccy: "USD", returnPct: usdReturn, href: "/portfolio" },
    { label: "코인", value: usdcTotal, ccy: "USDC", returnPct: hlReturn, href: "/portfolio" },
    { label: "폴리마켓", value: polymarketTotal, ccy: "USD", returnPct: null, href: "/polymarket" },
  ];

  // 통화 단위 다른 잔고(KRW/USD/USDC)는 합산 불가 — 수익률(%)만 자산군 비교 차트로
  const returnBars: BarItem[] = tiles
    .filter(t => t.returnPct != null)
    .map(t => ({ label: t.label, value: t.returnPct as number, href: t.href }));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-ap-ink-1 tracking-wide">총 포트폴리오</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(t => <AssetTile key={t.label} data={t} />)}
      </div>
      {returnBars.length > 0 && (
        <div className="bg-ap-surface border border-ap-line rounded-xl p-4">
          <p className="text-ap-ink-3 text-[10px] uppercase tracking-wide mb-2">자산군별 수익률</p>
          <BarChart items={returnBars} valueFmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`} />
        </div>
      )}
    </div>
  );
}
