"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getOmsOrders, getRealizedPnl, ApiError,
  type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type OmsOrder, type VenuePnl,
} from "@/lib/api";
import { SegmentedToggle, LoadingState, EmptyState, Bar } from "@/components/ui";
import { ApPanel, ApPanelHead, ApTickerBadge, ApGainBar, ApListRow, ApBottomSheet, ApLightHero, ApButton } from "@/components/ui/ApPrimitives";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";

const AP_TEXT = "text-ap-ink-3";
const AP_LEGEND = "text-ap-ink-3";

type Tab = "accounts" | "orders" | "pnl";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function fmt(v: number | null, ccy: string, compact = false): string {
  if (v == null) return "—";
  const locale = ccy === "KRW" ? "ko-KR" : "en-US";
  const symbol = ccy === "KRW" ? "₩" : ccy === "EUR" ? "€" : ccy === "USDC" ? "" : "$";
  const suffix = ccy === "USDC" ? " USDC" : "";
  if (compact && Math.abs(v) >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}M${suffix}`;
  if (compact && Math.abs(v) >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}K${suffix}`;
  return `${symbol}${v.toLocaleString(locale, { maximumFractionDigits: 0 })}${suffix}`;
}

function ModeChip({ mode, paper }: { mode?: string | null; paper?: boolean }) {
  const isPaper = paper ?? mode?.includes("paper") ?? false;
  return (
    <span className={`text-ap-micro px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${isPaper ? "bg-ap-caution/10 text-ap-caution" : "bg-ap-up/10 text-ap-up"}`}>
      {isPaper ? "페이퍼" : "실계좌"}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? "bg-ap-up" : "bg-ap-down"}`} />;
}

/** 원문 에러 → 사용자가 할 수 있는 조치. 매칭 안 되면 원문 앞 80자. */
function errorHint(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("connection refused") || e.includes("errno 61"))
    return "브로커 연결 끊김 — IB Gateway/TWS 실행 후 포트 7496 확인";
  if (e.includes("timeout") || e.includes("timed out"))
    return "응답 시간 초과 — 브로커 API 지연, 잠시 후 재시도";
  if (e.includes("401") || e.includes("403") || e.includes("unauthorized") || e.includes("token"))
    return "인증 실패 — API 키/토큰 만료 확인";
  return error.slice(0, 80);
}

// ── 계좌 카드 ────────────────────────────────────────────────────────────────

function AccountCard({
  label, ccy, balance, mode, paper, error, children,
}: {
  label: string; ccy: string; balance: number | null; mode?: string | null;
  paper?: boolean; error?: string | null; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ok = !error && balance != null;
  return (
    <div className="bg-ap-surface border border-ap-line rounded-ap-lg shadow-ap-sm overflow-hidden hover:border-ap-ink-3 transition-colors">
      <button onClick={() => setOpen(v => !v)} className="w-full text-left hover:bg-ap-bg transition-colors">
        <div className="flex items-center gap-3 px-4 py-3">
          <StatusDot ok={ok} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-ap-ink-1 text-sm font-semibold">{label}</span>
              <ModeChip mode={mode} paper={paper} />
            </div>
            {error ? (
              <p className="text-ap-down text-ap-body mt-0.5 truncate" title={error}>{errorHint(error)}</p>
            ) : (
              <p className="text-ap-ink-3 text-ap-body mt-0.5">{ccy}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-mono font-bold ${ok ? "text-ap-ink-1" : "text-ap-ink-3"}`}>
              {fmt(balance, ccy)}
            </p>
          </div>
          {children && (
            <span className="text-ap-ink-3 text-xs ml-1">{open ? "▲" : "▼"}</span>
          )}
        </div>
      </button>
      {open && children && (
        <div className="border-t border-ap-line px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── 알파카 포지션 인라인 ─────────────────────────────────────────────────────

// ── 벤더별 포지션/보유종목 목록 공용 렌더러 ───────────────────────────────────

function PositionRow({ name, side, sideLabel, pnlPositive, pnlLabel, detail }: {
  name: string; side?: boolean; sideLabel?: string; pnlPositive: boolean; pnlLabel: React.ReactNode; detail: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ap-ink-1 font-medium min-w-0 truncate">{name}</span>
          {sideLabel && (
            <span className={`text-ap-micro px-1 py-0.5 rounded shrink-0 ${side ? "bg-ap-up/10 text-ap-up" : "bg-ap-down/10 text-ap-down"}`}>
              {sideLabel}
            </span>
          )}
        </div>
        <span className={`font-mono px-1 font-bold shrink-0 text-right ${pnlPositive ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
          {pnlLabel}
        </span>
      </div>
      <p className="text-ap-ink-3 font-mono mt-0.5">{detail}</p>
    </div>
  );
}

function PositionList<T>({ items, keyFn, empty, row }: {
  items: T[]; keyFn: (item: T) => string; empty: string; row: (item: T) => React.ComponentProps<typeof PositionRow>;
}) {
  if (items.length === 0) return <p className="text-ap-ink-3 text-xs">{empty}</p>;
  return (
    <div className="divide-y divide-ap-line/60 text-ap-body">
      {items.map((item) => <PositionRow key={keyFn(item)} {...row(item)} />)}
    </div>
  );
}

function AlpacaPositions({ positions }: { positions: AlpacaPosition[] }) {
  return (
    <PositionList items={positions} keyFn={(p) => p.symbol} empty="포지션 없음" row={(p) => ({
      name: p.symbol,
      side: p.side === "long",
      sideLabel: p.side.toUpperCase(),
      pnlPositive: p.unrealized_pl >= 0,
      pnlLabel: <>{p.unrealized_pl >= 0 ? "+" : ""}${p.unrealized_pl.toFixed(2)}<span className="text-ap-ink-3 ml-1 font-normal">({(p.unrealized_plpc * 100).toFixed(1)}%)</span></>,
      detail: `${p.qty}주 @ $${p.avg_entry_price.toFixed(2)} → $${p.current_price.toFixed(2)}`,
    })} />
  );
}

// ── Hyperliquid 포지션 인라인 ────────────────────────────────────────────────

function HLPositions({ positions }: { positions: HLAssetPosition[] }) {
  return (
    <PositionList items={positions} keyFn={(p) => p.position.coin} empty="포지션 없음" row={(p) => {
      const pos = p.position;
      const szi = parseFloat(pos.szi);
      const isLong = szi >= 0;
      const pnl = parseFloat(pos.unrealizedPnl);
      const roe = parseFloat(pos.returnOnEquity) * 100;
      return {
        name: pos.coin,
        side: isLong,
        sideLabel: isLong ? "롱" : "숏",
        pnlPositive: pnl >= 0,
        pnlLabel: <>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}<span className="text-ap-ink-3 ml-1 font-normal">({roe.toFixed(1)}%)</span></>,
        detail: `${Math.abs(szi)} @ ${pos.entryPx ? `$${parseFloat(pos.entryPx).toFixed(2)}` : "—"} · 평가액 $${parseFloat(pos.positionValue).toFixed(2)}`,
      };
    }} />
  );
}

// ── KIS(한투) 보유종목 인라인 ─────────────────────────────────────────────────

function KISHoldings({ holdings }: { holdings: KISHolding[] }) {
  return (
    <PositionList items={holdings} keyFn={(h) => h.code} empty="보유 종목 없음" row={(h) => ({
      name: h.name,
      pnlPositive: (h.return_pct ?? 0) >= 0,
      pnlLabel: h.return_pct != null ? `${h.return_pct >= 0 ? "+" : ""}${h.return_pct.toFixed(1)}%` : "—",
      detail: `${h.qty}주 @ ₩${h.avg_price.toLocaleString("ko-KR")} → ₩${h.current.toLocaleString("ko-KR")}`,
    })} />
  );
}

// ── LKG Paper Trading 인라인 ─────────────────────────────────────────────────

function LkgPaperDetail({ paper }: { paper: PaperState }) {
  const totalPnl = paper.closed.reduce((s, c) => s + c.pnl, 0);
  if (paper.positions.length === 0 && paper.closed.length === 0)
    return <p className="text-ap-ink-3 text-xs">포지션 없음 — AI 업데이트 시 자동 진입</p>;
  return (
    <div className="space-y-3">
      {paper.positions.length > 0 && (
        <div className="divide-y divide-ap-line/60 text-ap-body">
          {paper.positions.map(p => (
            <div key={p.node_id} className="py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-ap-ink-1 font-medium">{p.symbol}</span>
                  <span className={`text-ap-micro px-1 py-0.5 rounded shrink-0 ${p.side === "BUY" ? "bg-ap-up/10 text-ap-up" : "bg-ap-down/10 text-ap-down"}`}>
                    {p.side}
                  </span>
                </div>
                <span className={`font-mono px-1 font-bold shrink-0 ${p.score_delta > 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
                  {p.score_delta > 0 ? "+" : ""}{p.score_delta.toFixed(3)}
                </span>
              </div>
              <p className="text-ap-ink-3 font-mono mt-0.5">진입 ${p.entry_price.toFixed(2)} · 평가 ${p.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      {paper.closed.length > 0 && (
        <div className="pt-1">
          <p className="text-ap-ink-3 text-ap-body mb-1">실현 손익: <span className={`font-mono px-1 font-bold ${totalPnl >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</span></p>
        </div>
      )}
    </div>
  );
}

// ── 섹션 헤더 ────────────────────────────────────────────────────────────────

function CcySection({ ccy, total, label, children }: { ccy: string; total: number | null; label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {label && <span className="text-ap-ink-1 text-sm font-semibold">{label}</span>}
        <span className="text-ap-ink-1 text-xs font-bold font-mono tracking-widest bg-ap-bg border border-ap-line rounded px-2 py-1">
          {ccy}
        </span>
        {total != null && (
          <span className="text-ap-brand text-base font-mono font-bold">{fmt(total, ccy)}</span>
        )}
        <div className="flex-1 h-px bg-ap-line" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ── Composition row (venue → currency 배분표, 표시만 · 실제 잔고 재사용) ──────

interface CompositionRow { venue: string; ccy: string; balance: number; share: number }

function CcyTotalTile({ label, value, ccy }: { label: string; value: number; ccy: string }) {
  return (
    <div className="bg-ap-surface border border-ap-line rounded-ap-lg shadow-ap-sm p-3">
      <p className="text-ap-ink-3 text-ap-body uppercase tracking-wide">{label}</p>
      <p className="text-ap-ink-1 text-lg font-mono font-bold mt-1">{fmt(value, ccy)}</p>
    </div>
  );
}

// ── 모바일 리스트용 공통 포지션 모양 ─────────────────────────────────────────

export interface MobilePosition {
  key: string; symbol: string; qty: string; avgPrice: string; currentPrice: string;
  pnlPct: number; venue: string; pnlAmount?: string;
}

export function alpacaToMobile(p: AlpacaPosition): MobilePosition {
  return {
    key: p.symbol, symbol: p.symbol, qty: `${p.side === "long" ? "롱" : "숏"} ${p.qty}주`,
    avgPrice: `$${p.avg_entry_price.toFixed(2)}`, currentPrice: `$${p.current_price.toFixed(2)}`,
    pnlPct: p.unrealized_plpc * 100, venue: "Alpaca",
    pnlAmount: `${p.unrealized_pl >= 0 ? "+" : ""}$${p.unrealized_pl.toFixed(2)}`,
  };
}

export function hlToMobile(p: HLAssetPosition, venue: string): MobilePosition {
  const pos = p.position;
  const szi = parseFloat(pos.szi);
  const roe = parseFloat(pos.returnOnEquity) * 100;
  const pnl = parseFloat(pos.unrealizedPnl);
  return {
    key: pos.coin, symbol: pos.coin, qty: `${szi >= 0 ? "롱" : "숏"} ${Math.abs(szi)}`,
    avgPrice: pos.entryPx ? `$${parseFloat(pos.entryPx).toFixed(2)}` : "—",
    currentPrice: `평가 $${parseFloat(pos.positionValue).toFixed(2)}`,
    pnlPct: roe, venue,
    pnlAmount: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
  };
}

export function kisToMobile(h: KISHolding, venue: string): MobilePosition {
  return {
    key: h.code, symbol: h.name, qty: `${h.qty}주`,
    avgPrice: `₩${h.avg_price.toLocaleString("ko-KR")}`,
    currentPrice: `₩${h.current.toLocaleString("ko-KR")}`,
    pnlPct: h.return_pct ?? 0, venue,
  };
}

function MobileGroup({ title, ccy, total, items, emptyHint, onSelect }: {
  title: string; ccy: string; total: number | null; items: MobilePosition[]; emptyHint: string;
  onSelect: (p: MobilePosition) => void;
}) {
  const maxAbs = Math.max(1, ...items.map((p) => Math.abs(p.pnlPct)));
  return (
    <div className="space-y-2">
      {total != null ? (
        <ApLightHero label={title} value={fmt(total, ccy)} />
      ) : (
        <span className="text-ap-ink-1 text-sm font-semibold px-1 block">{title}</span>
      )}
      <ApPanel>
        {items.length === 0 ? (
          <p className="text-ap-ink-3 text-xs p-3">{emptyHint}</p>
        ) : (
          <div className="divide-y divide-ap-line/60">
            {items.map((p, i) => (
              <ApListRow key={`${p.key}-${i}`}
                leading={<ApTickerBadge symbol={p.symbol} />}
                title={p.symbol}
                subtitle={`${p.qty} · ${p.avgPrice} · ${p.venue}`}
                trailing={<span className={p.pnlPct >= 0 ? "text-ap-up" : "text-ap-down"}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%</span>}
                trailingSub={<div className="w-14"><ApGainBar pct={p.pnlPct} maxAbs={maxAbs} /></div>}
                onClick={() => onSelect(p)}
              />
            ))}
          </div>
        )}
      </ApPanel>
    </div>
  );
}

// ── 계좌 현황 탭 ─────────────────────────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  const [alpacaAcct, setAlpacaAcct] = useState<AlpacaAccount | null>(null);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [hlTestnetPositions, setHlTestnetPositions] = useState<HLAssetPosition[]>([]);
  const [hlMainnetPositions, setHlMainnetPositions] = useState<HLAssetPosition[]>([]);
  const [kisMockHoldings, setKisMockHoldings] = useState<KISHolding[]>([]);
  const [kisLiveHoldings, setKisLiveHoldings] = useState<KISHolding[]>([]);
  const [loading, setLoading] = useState(true);
  // 느린 balances(KIS 최대 30초)가 도착 전까지 "계좌 없음" 오표시 방지
  const [balancesPending, setBalancesPending] = useState(true);
  const [selected, setSelected] = useState<MobilePosition | null>(null);
  const router = useRouter();

  const load = useCallback(() => {
    // Fast: Alpaca + LKG paper — show UI immediately
    Promise.allSettled([
      getAlpacaAccount(),
      getAlpacaPositions(),
      getPaperState(),
      getHLPositions(true),
      getHLPositions(false),
    ]).then(([acctRes, posRes, paperRes, hlTestRes, hlMainRes]) => {
      if (acctRes.status === "fulfilled") setAlpacaAcct(acctRes.value);
      if (posRes.status === "fulfilled") setAlpacaPositions(posRes.value);
      if (paperRes.status === "fulfilled") setPaper(paperRes.value);
      if (hlTestRes.status === "fulfilled") setHlTestnetPositions(hlTestRes.value.asset_positions);
      if (hlMainRes.status === "fulfilled") setHlMainnetPositions(hlMainRes.value.asset_positions);
      setLoading(false);
    });
    // Slow: full balances (KIS can take 30s+) — abort after 20s
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 20_000);
    getAccountBalances(ctrl.signal)
      .then(r => setAccounts(r.accounts))
      .catch(() => {})
      .finally(() => { clearTimeout(tid); setBalancesPending(false); });
    getKisHoldings(true, ctrl.signal).then(r => setKisMockHoldings(r.holdings)).catch(() => {});
    getKisHoldings(false, ctrl.signal).then(r => setKisLiveHoldings(r.holdings)).catch(() => {});
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  // 통화별 분류
  const usdAccounts = accounts.filter(a => a.ccy === "USD");
  const krwAccounts = accounts.filter(a => a.ccy === "KRW");
  const eurAccounts = accounts.filter(a => a.ccy === "EUR");
  const usdcAccounts = accounts.filter(a => a.ccy === "USDC");

  const lkgBalance = paper ? paper.cash + paper.positions.reduce((s, p) => s + p.value, 0) : null;

  // USD total: fast Alpaca + LKG + any other USD accounts from slow source
  const otherUsd = usdAccounts.filter(a => a.venue !== "alpaca").reduce((s, a) => s + (a.balance ?? 0), 0);
  const usdTotal = (alpacaAcct?.portfolio_value ?? 0) + (lkgBalance ?? 0) + otherUsd;

  const krwTotal = krwAccounts.every(a => a.balance == null) ? null
    : krwAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  const eurTotal = eurAccounts.length > 0 ? eurAccounts.reduce((s, a) => s + (a.balance ?? 0), 0) : null;
  const usdcTotal = usdcAccounts.every(a => a.balance == null) ? null
    : usdcAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  // 계좌현황 탭에 이미 표시되는 잔고를 재사용해 venue별 구성비(=배분) 표를 구성. 새 계산 없음.
  const compositionRows: CompositionRow[] = [
    ...(alpacaAcct ? [{ venue: "Alpaca · 미국주식", ccy: "USD", balance: alpacaAcct.portfolio_value, share: usdTotal > 0 ? alpacaAcct.portfolio_value / usdTotal : 0 }] : []),
    ...(paper ? [{ venue: "LKG 페이퍼", ccy: "USD", balance: lkgBalance ?? 0, share: usdTotal > 0 ? (lkgBalance ?? 0) / usdTotal : 0 }] : []),
    ...usdAccounts.filter(a => a.venue !== "alpaca" && a.balance != null).map(a => ({ venue: a.label, ccy: "USD", balance: a.balance as number, share: usdTotal > 0 ? (a.balance as number) / usdTotal : 0 })),
    ...krwAccounts.filter(a => a.balance != null).map(a => ({ venue: a.label, ccy: "KRW", balance: a.balance as number, share: krwTotal ? (a.balance as number) / krwTotal : 0 })),
    ...eurAccounts.filter(a => a.balance != null).map(a => ({ venue: a.label, ccy: "EUR", balance: a.balance as number, share: eurTotal ? (a.balance as number) / eurTotal : 0 })),
    ...usdcAccounts.filter(a => a.balance != null).map(a => ({ venue: a.label, ccy: "USDC", balance: a.balance as number, share: usdcTotal ? (a.balance as number) / usdcTotal : 0 })),
  ];

  if (loading) return (
    <div className="py-12">
      <LoadingState message="계좌 잔고 조회 중…" hint="브로커 6곳 순차 조회 — 5~10초 걸립니다" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
    </div>
  );

  const krwMobile: MobilePosition[] = [
    ...kisMockHoldings.map((h) => kisToMobile(h, "한투 모의")),
    ...kisLiveHoldings.map((h) => kisToMobile(h, "한투 실계좌")),
  ];
  const usdMobile: MobilePosition[] = alpacaPositions.map(alpacaToMobile);
  const usdcMobile: MobilePosition[] = [
    ...hlTestnetPositions.map((p) => hlToMobile(p, "HL 테스트넷")),
    ...hlMainnetPositions.map((p) => hlToMobile(p, "HL 메인넷")),
  ];

  return (
    <>
    <div className="hidden md:grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-4 items-start">
      {/* LEFT — 자산군별 합계, quick nav */}
      <div className="space-y-3">
        {krwTotal != null && <CcyTotalTile label="국내주식 합계" value={krwTotal} ccy="KRW" />}
        <CcyTotalTile label="해외주식 합계" value={usdTotal} ccy="USD" />
        {eurTotal != null && <CcyTotalTile label="해외주식 합계 (EUR)" value={eurTotal} ccy="EUR" />}
        {usdcTotal != null && <CcyTotalTile label="코인 합계" value={usdcTotal} ccy="USDC" />}
      </div>

      {/* CENTER — 자산군별 계좌 카드, main workspace */}
      <div className="space-y-8 min-w-0">
        <CcySection ccy="KRW" total={krwTotal} label="국내주식">
          {krwAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="KRW"
              balance={a.balance} mode={a.mode} error={a.error}>
              <KISHoldings holdings={a.venue === "kis_mock" ? kisMockHoldings : kisLiveHoldings} />
            </AccountCard>
          ))}
          {krwAccounts.length === 0 && (
            <p className="text-ap-ink-3 text-xs">{balancesPending ? "한투 잔고 조회 중… (최대 30초)" : "국내주식 계좌 없음"}</p>
          )}
        </CcySection>

        <CcySection ccy="USD" total={usdTotal > 0 ? usdTotal : null} label="해외주식">
          {alpacaAcct && (
            <AccountCard label="Alpaca · 미국주식" ccy="USD"
              balance={alpacaAcct.portfolio_value} paper={alpacaAcct.paper}>
              <AlpacaPositions positions={alpacaPositions} />
            </AccountCard>
          )}
          {usdAccounts.filter(a => a.venue !== "alpaca").map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USD"
              balance={a.balance} mode={a.mode} error={a.error} />
          ))}
          {paper && (
            <AccountCard label="LKG 페이퍼 트레이딩" ccy="USD"
              balance={lkgBalance} paper={true}>
              <LkgPaperDetail paper={paper} />
            </AccountCard>
          )}
        </CcySection>

        {eurAccounts.length > 0 && (
          <CcySection ccy="EUR" total={eurTotal} label="해외주식">
            {eurAccounts.map(a => (
              <AccountCard key={a.venue} label={a.label} ccy="EUR"
                balance={a.balance} mode={a.mode} error={a.error} />
            ))}
          </CcySection>
        )}

        <CcySection ccy="USDC" total={usdcTotal} label="코인">
          {usdcAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USDC"
              balance={a.balance} mode={a.mode} error={a.error}>
              <HLPositions positions={a.venue === "hl_testnet" ? hlTestnetPositions : hlMainnetPositions} />
            </AccountCard>
          ))}
          {usdcAccounts.length === 0 && (
            <p className="text-ap-ink-3 text-xs">{balancesPending ? "HL 잔고 조회 중…" : "Hyperliquid 계좌 없음"}</p>
          )}
        </CcySection>
      </div>

      {/* RIGHT — composition (venue → 통화별 잔고 구성비), 기본 접힘 (스펙: accounts 탭 상단은 계좌현황+포지션만 기본 노출) */}
      <details className="group rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden">
        <summary className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ap-line cursor-pointer list-none">
          <span className="text-sm font-semibold text-ap-ink-1">거래소별 분포 <span className="text-ap-ink-3 text-ap-body font-normal">(구성)</span></span>
          <span className="text-ap-ink-3 text-xs group-open:hidden">펼치기 ▾</span>
          <span className="text-ap-ink-3 text-xs hidden group-open:inline">접기 ▴</span>
        </summary>
        <div className="p-1">
          {compositionRows.length === 0 ? (
            <p className="text-ap-ink-3 text-xs p-2">연동 계좌 없음</p>
          ) : (
            <div className="divide-y divide-ap-line/60 text-ap-body">
              {[...compositionRows].sort((a, b) => b.balance - a.balance).map(r => (
                <div key={`${r.venue}-${r.ccy}`} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-ap-ink-1 truncate">{r.venue}</p>
                    <p className="text-ap-ink-3">{r.ccy} · {fmt(r.balance, r.ccy, true)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <Bar ratio={r.share} tone="bg-ap-brand/70" trackClass="bg-ap-bg border-ap-line" />
                    <span className="tabular-nums text-ap-ink-2">{(r.share * 100).toFixed(1)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="px-3 pb-3 text-ap-body text-ap-ink-3 leading-relaxed">
          통화 내 venue 잔고 구성비 · 손익 귀속(attribution)이 아닌 배분 현황 표시.
        </p>
      </details>
    </div>

    <div className="md:hidden space-y-6">
      <MobileGroup title="국내주식" ccy="KRW" total={krwTotal} items={krwMobile}
        emptyHint={balancesPending ? "한투 잔고 조회 중… (최대 30초)" : "국내주식 보유 종목 없음"}
        onSelect={setSelected} />
      <MobileGroup title="해외주식" ccy="USD" total={usdTotal > 0 ? usdTotal : null} items={usdMobile}
        emptyHint="해외주식 보유 종목 없음" onSelect={setSelected} />
      <MobileGroup title="코인" ccy="USDC" total={usdcTotal} items={usdcMobile}
        emptyHint={balancesPending ? "HL 잔고 조회 중…" : "코인 보유 종목 없음"} onSelect={setSelected} />

      {compositionRows.length > 0 && (
        <details className="group rounded-ap-lg border border-ap-line bg-ap-surface shadow-ap-sm overflow-hidden">
          <summary className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ap-line cursor-pointer list-none">
            <span className="text-sm font-semibold text-ap-ink-1">계좌 내 거래소 비중</span>
            <span className="text-ap-ink-3 text-xs group-open:hidden">펼치기 ▾</span>
            <span className="text-ap-ink-3 text-xs hidden group-open:inline">접기 ▴</span>
          </summary>
          <div className="divide-y divide-ap-line/60 p-1">
            {[...compositionRows].sort((a, b) => b.balance - a.balance).map(r => (
              <div key={`${r.venue}-${r.ccy}`} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-ap-ink-1 text-sm truncate">{r.venue}</p>
                  <p className="text-ap-ink-3 text-xs">{r.ccy} · {fmt(r.balance, r.ccy, true)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <Bar ratio={r.share} tone="bg-ap-brand/70" trackClass="bg-ap-bg border-ap-line" />
                  <span className="tabular-nums text-ap-ink-2 text-xs">{(r.share * 100).toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>

    <ApBottomSheet open={selected != null} onClose={() => setSelected(null)} title={selected?.symbol ?? ""}>
      {selected && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">평균단가</span><span className="text-ap-ink-1 font-mono">{selected.avgPrice}</span></div>
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">현재가</span><span className="text-ap-ink-1 font-mono">{selected.currentPrice}</span></div>
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">수량</span><span className="text-ap-ink-1 font-mono">{selected.qty}</span></div>
          <div className="flex justify-between text-sm">
            <span className="text-ap-ink-3">평가손익</span>
            <span className={`font-mono font-semibold ${selected.pnlPct >= 0 ? "text-ap-up" : "text-ap-down"}`}>
              {selected.pnlAmount && <>{selected.pnlAmount} </>}
              {selected.pnlPct >= 0 ? "+" : ""}{selected.pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-sm"><span className="text-ap-ink-3">venue</span><span className="text-ap-ink-1">{selected.venue}</span></div>
          <ApButton size="md" className="w-full mt-2" onClick={() => router.push(`/research-os/chat?q=${encodeURIComponent(selected.symbol)}`)}>
            AI 판단 보러가기 →
          </ApButton>
        </div>
      )}
    </ApBottomSheet>
    </>
  );
}

// ── 주문 탭 (구 OMS 페이지) ──────────────────────────────────────────────────

const VENUES = ["ALL", "KR", "US", "US_OPTIONS"] as const;
const STATUSES = ["ALL", "OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED", "REJECTED"] as const;

const VENUE_LABEL: Record<string, string> = { ALL: "전체" };
const STATUS_LABEL: Record<string, string> = {
  ALL: "전체",
  OPEN: "미체결",
  PARTIALLY_FILLED: "부분체결",
  FILLED: "체결완료",
  CANCELLED: "취소",
  REJECTED: "거부",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "text-ap-note bg-ap-note/10 border-ap-note/30",
  PARTIALLY_FILLED: "text-ap-caution bg-ap-caution/10 border-ap-caution/30",
  FILLED: "text-ap-up bg-ap-up/10 border-ap-up/30",
  CANCELLED: "text-ap-ink-3 bg-ap-bg border-ap-line",
  REJECTED: "text-ap-down bg-ap-down/10 border-ap-down/30",
};

function fmtTs(ts: string) {
  return ts.replace("T", " ").slice(0, 19);
}

function OrdersTab() {
  const [orders, setOrders] = useState<OmsOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venue, setVenue] = useState<(typeof VENUES)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<OmsOrder | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    getOmsOrders(
      { venue: venue === "ALL" ? undefined : venue, status: status === "ALL" ? undefined : status },
      c.signal,
    )
      .then(d => { if (!c.signal.aborted) { setOrders(d.orders); setLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, [venue, status]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  return (
    <div className="space-y-4 max-w-5xl">
      <p className="text-ap-ink-3 text-sm">
        제출된 주문의 실시간 상태 · 부분체결 진행. 서버 프로세스 재시작 시 초기화됨(영구 기록은 <span className="font-data">/orders/audit</span>).
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        <SegmentedToggle
          value={venue}
          onChange={setVenue}
          size="sm"
          inactiveClass="border-ap-line text-ap-ink-3 hover:text-ap-ink-2"
          options={VENUES.map(v => ({ value: v, label: VENUE_LABEL[v] ?? v }))}
        />
        <div className="w-px bg-ap-line" />
        <SegmentedToggle
          value={status}
          onChange={setStatus}
          size="sm"
          inactiveClass="border-ap-line text-ap-ink-3 hover:text-ap-ink-2"
          options={STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] ?? s }))}
        />
      </div>

      {error ? <div className="text-ap-down text-sm bg-ap-down/10 border border-ap-down/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="주문 상태 로딩 중…" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
        : !orders || orders.length === 0 ? <EmptyState message="추적 중인 주문 없음" textClass="text-ap-ink-3" />
        : (
          <>
            <ApPanel className="hidden md:block">
              <ApPanelHead title="주문 목록" right={<span>{orders.length}건</span>} />
              <div className="divide-y divide-ap-line/60 text-sm">
                {orders.map(o => {
                  const key = `${o.venue}:${o.order_id}`;
                  const total = o.filled + o.remaining;
                  const pct = total > 0 ? Math.round((o.filled / total) * 100) : 0;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => setExpanded(expanded === key ? null : key)}
                        className="w-full px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-left hover:bg-ap-bg"
                      >
                        <span className="text-ap-ink-3 shrink-0 font-data">{o.venue}</span>
                        <span className="text-ap-ink-1 shrink-0 font-data truncate max-w-[8rem]">{o.order_id}</span>
                        <span className={`text-ap-body px-2 py-0.5 rounded border shrink-0 ${STATUS_STYLE[o.status] ?? ""}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                        <div className="flex-1 min-w-[80px] flex items-center gap-2">
                          <Bar ratio={pct / 100} tone="bg-ap-brand" width="flex-1" trackClass="bg-ap-bg border-ap-line" />
                          <span className="text-ap-ink-3 font-data shrink-0">{o.filled}/{total} ({pct}%)</span>
                        </div>
                        <span className="text-ap-ink-3 font-data shrink-0">{fmtTs(o.updated_ts)}</span>
                      </button>
                      {expanded === key && (
                        <div className="px-4 pb-3 pl-8">
                          <div className="text-ap-ink-3 text-ap-body mb-1">체결 이력 ({o.history.length}건)</div>
                          <div className="space-y-1">
                            {o.history.map((h, i) => (
                              <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 font-data text-ap-body text-ap-ink-3">
                                <span className="shrink-0">{fmtTs(h.ts)}</span>
                                <span className={`shrink-0 ${STATUS_STYLE[h.status]?.split(" ")[0] ?? ""}`}>{STATUS_LABEL[h.status] ?? h.status}</span>
                                <span>{h.filled}/{h.filled + h.remaining}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ApPanel>

            <ApPanel className="md:hidden">
              <div className="px-4 py-3 border-b border-ap-line flex items-center justify-between">
                <span className="text-sm font-semibold text-ap-ink-1">주문 목록</span>
                <span className="text-ap-ink-3 text-xs">{orders.length}건</span>
              </div>
              <div className="divide-y divide-ap-line/60">
                {orders.map(o => {
                  const total = o.filled + o.remaining;
                  const pct = total > 0 ? Math.round((o.filled / total) * 100) : 0;
                  return (
                    <button key={`${o.venue}:${o.order_id}`} onClick={() => setSelected(o)}
                      className="w-full px-4 py-3 flex flex-col gap-1.5 text-left active:bg-ap-bg">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-ap-ink-1 text-sm font-data truncate">{o.venue} · {o.order_id}</span>
                        <span className={`text-ap-body px-2 py-0.5 rounded border shrink-0 ${STATUS_STYLE[o.status] ?? ""}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bar ratio={pct / 100} tone="bg-ap-brand" width="flex-1" trackClass="bg-ap-bg border-ap-line" />
                        <span className="text-ap-ink-3 font-data text-xs shrink-0">{o.filled}/{total}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ApPanel>
          </>
        )}

      <ApBottomSheet open={selected != null} onClose={() => setSelected(null)} title={selected?.order_id ?? ""}>
        {selected && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-ap-ink-3">venue</span><span className="text-ap-ink-1 font-data">{selected.venue}</span></div>
            <div className="flex justify-between text-sm">
              <span className="text-ap-ink-3">상태</span>
              <span className={`text-ap-body px-2 py-0.5 rounded border ${STATUS_STYLE[selected.status] ?? ""}`}>{STATUS_LABEL[selected.status] ?? selected.status}</span>
            </div>
            <div className="flex justify-between text-sm"><span className="text-ap-ink-3">체결</span><span className="text-ap-ink-1 font-data">{selected.filled}/{selected.filled + selected.remaining}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ap-ink-3">업데이트</span><span className="text-ap-ink-1 font-data">{fmtTs(selected.updated_ts)}</span></div>
            {selected.history.length > 0 && (
              <div className="pt-2 border-t border-ap-line">
                <div className="text-ap-ink-3 text-ap-body mb-1.5">체결 이력 ({selected.history.length}건)</div>
                <div className="space-y-1">
                  {selected.history.map((h, i) => (
                    <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 font-data text-ap-body text-ap-ink-3">
                      <span className="shrink-0">{fmtTs(h.ts)}</span>
                      <span className={`shrink-0 ${STATUS_STYLE[h.status]?.split(" ")[0] ?? ""}`}>{STATUS_LABEL[h.status] ?? h.status}</span>
                      <span>{h.filled}/{h.filled + h.remaining}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ApBottomSheet>
    </div>
  );
}

// ── 손익 탭 (구 PnL 페이지) ──────────────────────────────────────────────────

function fmtPnl(v: number) {
  const s = v.toFixed(2);
  return v > 0 ? `+${s}` : s;
}

function pnlColor(v: number) {
  return v > 0 ? "text-ap-up" : v < 0 ? "text-ap-down" : "text-ap-ink-3";
}

function VenueCard({ v }: { v: VenuePnl }) {
  // 체결 원장 running-sum → 누적 실현손익 곡선(gross)
  const pnlCurve: TSSeries[] = (() => {
    const pts = v.trades
      .filter(t => typeof t.realized_pnl === "number")
      .map(t => ({ t: Math.floor(new Date(t.ts).getTime() / 1000), pnl: t.realized_pnl as number }))
      .filter(t => Number.isFinite(t.t))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) return [];
    let run = 0;
    const points = pts.map(p => { run += p.pnl; return { time: p.t, value: Math.round(run * 100) / 100 }; });
    const last = points[points.length - 1].value;
    return [{ label: "누적 실현손익", color: last >= 0 ? TOKEN.pos : TOKEN.neg, points }];
  })();

  return (
    <ApPanel>
      <ApPanelHead title={v.venue} right={<span>체결 {v.trades.length}건</span>} />
      <div className="p-4 grid grid-cols-3 gap-4 text-sm border-b border-ap-line/60">
        <div>
          <div className="text-ap-ink-3 text-xs mb-0.5">총 실현손익</div>
          <div className={`font-data text-base ${pnlColor(v.gross_realized_pnl)}`}>{fmtPnl(v.gross_realized_pnl)}</div>
        </div>
        <div>
          <div className="text-ap-ink-3 text-xs mb-0.5">수수료(설정값, 추정)</div>
          <div className="font-data text-base text-ap-ink-2">-{v.fees.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-ap-ink-3 text-xs mb-0.5">순 실현손익</div>
          <div className={`font-data text-base font-semibold ${pnlColor(v.net_realized_pnl)}`}>{fmtPnl(v.net_realized_pnl)}</div>
        </div>
      </div>

      {v.unpriced_fills > 0 && (
        <div className="px-4 py-2 text-xs text-ap-caution bg-ap-caution/10 border-b border-ap-caution/30">
          체결가 미확인 주문 {v.unpriced_fills}건 — 손익 계산에서 제외됨
        </div>
      )}

      {pnlCurve.length > 0 && (
        <div className="p-3 border-b border-ap-line/60">
          <ChartFrame title="누적 실현손익 추이" caption="체결 원장 누적합(총액, 수수료 전)" textClass={AP_TEXT} legendTextClass={AP_LEGEND}>
            <TimeSeries series={pnlCurve} height={160} yFormat={(x) => x.toFixed(0)} />
          </ChartFrame>
        </div>
      )}

      {v.open_positions.length > 0 && (
        <div className="px-4 py-3 border-b border-ap-line/60">
          <div className="text-ap-ink-3 text-xs mb-1.5">보유 포지션</div>
          <div className="space-y-1 text-sm font-data">
            {v.open_positions.map(p => (
              <div key={p.symbol} className="flex gap-3 text-ap-ink-1">
                <span className="w-24 shrink-0">{p.symbol}</span>
                <span className="text-ap-ink-3">{p.qty} @ {p.avg_price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.trades.length > 0 && (
        <div className="divide-y divide-ap-line/60 text-sm">
          {v.trades.map((t, i) => (
            <div key={i} className="px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-ap-ink-3 shrink-0 font-data">{fmtTs(t.ts)}</span>
              <span className="text-ap-ink-1 shrink-0 font-data">{t.symbol}</span>
              <span className={`shrink-0 font-data ${t.side === "buy" ? "text-ap-up" : "text-ap-down"}`}>{t.side}</span>
              <span className="text-ap-ink-3 font-data shrink-0">{t.qty}주</span>
              <span className="text-ap-ink-1 font-data shrink-0">
                {t.price}
                {t.price_source === "estimated" && (
                  <span className="ml-1 text-ap-body text-ap-caution" title="브로커 체결가 미제공 — 주문가로 추정">추정</span>
                )}
              </span>
              <span className={`font-data flex-1 text-right ${t.realized_pnl == null ? "text-ap-ink-3" : pnlColor(t.realized_pnl)}`}>
                {t.realized_pnl == null ? "—" : fmtPnl(t.realized_pnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </ApPanel>
  );
}

function MobileVenueCard({ v }: { v: VenuePnl }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? v.trades : v.trades.slice(0, 5);
  return (
    <ApPanel>
      <div className="px-4 py-3 border-b border-ap-line flex items-center justify-between">
        <span className="text-sm font-semibold text-ap-ink-1">{v.venue}</span>
        <span className={`font-data text-base font-semibold ${pnlColor(v.net_realized_pnl)}`}>{fmtPnl(v.net_realized_pnl)}</span>
      </div>

      {v.unpriced_fills > 0 && (
        <div className="px-4 py-2 text-xs text-ap-caution bg-ap-caution/10 border-b border-ap-caution/30">
          체결가 미확인 {v.unpriced_fills}건 — 손익 제외
        </div>
      )}

      {v.open_positions.length > 0 && (
        <div className="px-4 py-2.5 border-b border-ap-line/60 space-y-1 text-sm font-data">
          {v.open_positions.map(p => (
            <div key={p.symbol} className="flex gap-3 text-ap-ink-1">
              <span className="w-20 shrink-0 truncate">{p.symbol}</span>
              <span className="text-ap-ink-3">{p.qty} @ {p.avg_price}</span>
            </div>
          ))}
        </div>
      )}

      {v.trades.length > 0 && (
        <>
          <div className="divide-y divide-ap-line/60 text-sm">
            {shown.map((t, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-2">
                <span className="text-ap-ink-1 font-data shrink-0">{t.symbol}</span>
                <span className={`font-data shrink-0 text-xs ${t.side === "buy" ? "text-ap-up" : "text-ap-down"}`}>{t.side}</span>
                <span className={`font-data flex-1 text-right ${t.realized_pnl == null ? "text-ap-ink-3" : pnlColor(t.realized_pnl)}`}>
                  {t.realized_pnl == null ? "—" : fmtPnl(t.realized_pnl)}
                </span>
              </div>
            ))}
          </div>
          {v.trades.length > 5 && (
            <button onClick={() => setShowAll(s => !s)} className="w-full py-2.5 text-center text-xs text-ap-ink-3 active:opacity-70">
              {showAll ? "접기" : `전체 ${v.trades.length}건 보기`}
            </button>
          )}
        </>
      )}
    </ApPanel>
  );
}

function PnlTab() {
  const [venues, setVenues] = useState<VenuePnl[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    getRealizedPnl(c.signal)
      .then(d => { if (!c.signal.aborted) { setVenues(d.venues); setLoading(false); } })
      .catch(e => { if (!c.signal.aborted) { setError(e instanceof ApiError ? e.message : String(e)); setLoading(false); } });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => { clearInterval(iv); ctrl.current?.abort(); };
  }, [load]);

  return (
    <div className="space-y-4 max-w-5xl">
      <p className="text-ap-ink-3 text-sm">
        OMS 체결 기록 FIFO 매칭. KR 체결가는 브로커가 제공 안 해서 주문가로 추정 표시(<span className="text-ap-caution">추정</span> 배지).
        수수료는 실 브로커 커미션이 아니라 설정한 bps 추정값(<span className="font-data">PNL_FEE_BPS_*</span> 환경변수, 기본 0).
      </p>

      {error ? <div className="text-ap-down text-sm bg-ap-down/10 border border-ap-down/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="손익 계산 중…" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
        : !venues || venues.length === 0 ? <EmptyState message="체결된 주문 없음" textClass="text-ap-ink-3" />
        : (
          <>
            <div className="hidden md:block space-y-4">{venues.map(v => <VenueCard key={v.venue} v={v} />)}</div>
            <div className="md:hidden space-y-3">{venues.map(v => <MobileVenueCard key={v.venue} v={v} />)}</div>
          </>
        )}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("accounts");

  return (
    <div className="min-h-full bg-ap-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 flex-wrap px-4 sm:px-5 py-3 border-b border-ap-line bg-ap-bg/85 backdrop-blur">
        <div className="flex items-baseline gap-2.5">
          <span className="text-ap-ink-3 text-ap-micro font-semibold tracking-[0.24em] uppercase">계좌현황 · 주문 · 손익</span>
          <span className="text-ap-ink-1 text-ap-title font-semibold tracking-wide">포트폴리오</span>
        </div>
        <SegmentedToggle
          value={tab}
          onChange={setTab}
          size="sm"
          inactiveClass="border-ap-line text-ap-ink-3 hover:text-ap-ink-2"
          options={[
            { value: "accounts", label: "계좌 현황" },
            { value: "orders", label: "주문" },
            { value: "pnl", label: "손익" },
          ]}
          variant="ap-pill"
        />
      </header>

      <div className="p-4 sm:p-5">
        {tab === "accounts" && <AccountsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "pnl" && <PnlTab />}
      </div>
    </div>
  );
}
