"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getOmsOrders, getRealizedPnl, ApiError,
  type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type OmsOrder, type VenuePnl,
} from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedToggle, LoadingState, EmptyState, Bar } from "@/components/ui";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";

const AP_TEXT = "text-ap-ink-3";
const AP_LEGEND = "text-ap-ink-3";

type Tab = "accounts" | "orders" | "pnl" | "optimizer";

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
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${isPaper ? "bg-ap-caution/10 text-ap-caution" : "bg-ap-up/10 text-ap-up"}`}>
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
              <p className="text-ap-down text-[10px] mt-0.5 truncate" title={error}>{errorHint(error)}</p>
            ) : (
              <p className="text-ap-ink-3 text-[10px] mt-0.5">{ccy}</p>
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

function AlpacaPositions({ positions }: { positions: AlpacaPosition[] }) {
  if (positions.length === 0) return <p className="text-ap-ink-3 text-xs">포지션 없음</p>;
  return (
    <div className="divide-y divide-ap-line/60 text-[11px]">
      {positions.map(p => (
        <div key={p.symbol} className="py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-ap-ink-1 font-medium">{p.symbol}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${p.side === "long" ? "bg-ap-up/10 text-ap-up" : "bg-ap-down/10 text-ap-down"}`}>
                {p.side.toUpperCase()}
              </span>
            </div>
            <span className={`font-mono px-1 font-bold shrink-0 text-right ${p.unrealized_pl >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
              {p.unrealized_pl >= 0 ? "+" : ""}${p.unrealized_pl.toFixed(2)}
              <span className="text-ap-ink-3 ml-1 font-normal">({(p.unrealized_plpc * 100).toFixed(1)}%)</span>
            </span>
          </div>
          <p className="text-ap-ink-3 font-mono mt-0.5">{p.qty}주 @ ${p.avg_entry_price.toFixed(2)} → ${p.current_price.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Hyperliquid 포지션 인라인 ────────────────────────────────────────────────

function HLPositions({ positions }: { positions: HLAssetPosition[] }) {
  if (positions.length === 0) return <p className="text-ap-ink-3 text-xs">포지션 없음</p>;
  return (
    <div className="divide-y divide-ap-line/60 text-[11px]">
      {positions.map(p => {
        const pos = p.position;
        const szi = parseFloat(pos.szi);
        const isLong = szi >= 0;
        const pnl = parseFloat(pos.unrealizedPnl);
        const roe = parseFloat(pos.returnOnEquity) * 100;
        return (
          <div key={pos.coin} className="py-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-ap-ink-1 font-medium">{pos.coin}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${isLong ? "bg-ap-up/10 text-ap-up" : "bg-ap-down/10 text-ap-down"}`}>
                  {isLong ? "롱" : "숏"}
                </span>
              </div>
              <span className={`font-mono px-1 font-bold shrink-0 text-right ${pnl >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                <span className="text-ap-ink-3 ml-1 font-normal">({roe.toFixed(1)}%)</span>
              </span>
            </div>
            <p className="text-ap-ink-3 font-mono mt-0.5">
              {Math.abs(szi)} @ {pos.entryPx ? `$${parseFloat(pos.entryPx).toFixed(2)}` : "—"} · 평가액 ${parseFloat(pos.positionValue).toFixed(2)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── KIS(한투) 보유종목 인라인 ─────────────────────────────────────────────────

function KISHoldings({ holdings }: { holdings: KISHolding[] }) {
  if (holdings.length === 0) return <p className="text-ap-ink-3 text-xs">보유 종목 없음</p>;
  return (
    <div className="divide-y divide-ap-line/60 text-[11px]">
      {holdings.map(h => (
        <div key={h.code} className="py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ap-ink-1 font-medium min-w-0 truncate">{h.name}</span>
            <span className={`font-mono px-1 font-bold shrink-0 text-right ${(h.return_pct ?? 0) >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>
              {h.return_pct != null ? `${h.return_pct >= 0 ? "+" : ""}${h.return_pct.toFixed(1)}%` : "—"}
            </span>
          </div>
          <p className="text-ap-ink-3 font-mono mt-0.5">{h.qty}주 @ ₩{h.avg_price.toLocaleString("ko-KR")} → ₩{h.current.toLocaleString("ko-KR")}</p>
        </div>
      ))}
    </div>
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
        <div className="divide-y divide-ap-line/60 text-[11px]">
          {paper.positions.map(p => (
            <div key={p.node_id} className="py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-ap-ink-1 font-medium">{p.symbol}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${p.side === "BUY" ? "bg-ap-up/10 text-ap-up" : "bg-ap-down/10 text-ap-down"}`}>
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
          <p className="text-ap-ink-3 text-[10px] mb-1">실현 손익: <span className={`font-mono px-1 font-bold ${totalPnl >= 0 ? "bg-ap-up/20 text-ap-up" : "bg-ap-down/20 text-ap-down"}`}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</span></p>
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
      <p className="text-ap-ink-3 text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-ap-ink-1 text-lg font-mono font-bold mt-1">{fmt(value, ccy)}</p>
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-4 items-start">
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

      {/* RIGHT — composition (venue → 통화별 잔고 구성비) */}
      <Card>
        <CardHeader>거래소별 분포 <span className="text-ap-ink-3 text-[10px] font-normal">(구성)</span></CardHeader>
        <div className="p-1">
          {compositionRows.length === 0 ? (
            <p className="text-ap-ink-3 text-xs p-2">연동 계좌 없음</p>
          ) : (
            <div className="divide-y divide-ap-line/60 text-[11px]">
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
        <p className="px-3 pb-3 text-[10px] text-ap-ink-3 leading-relaxed">
          통화 내 venue 잔고 구성비 · 손익 귀속(attribution)이 아닌 배분 현황 표시.
        </p>
      </Card>
    </div>
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
          options={VENUES.map(v => ({ value: v, label: VENUE_LABEL[v] ?? v }))}
        />
        <div className="w-px bg-ap-line" />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded border ${status === s ? "border-ap-brand text-ap-brand bg-ap-brand/10" : "border-ap-line text-ap-ink-3 hover:text-ap-ink-1"}`}>
              {STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="text-ap-down text-sm bg-ap-down/10 border border-ap-down/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="주문 상태 로딩 중…" textClass="text-ap-ink-3" spinnerClass="border-ap-line border-t-ap-brand" />
        : !orders || orders.length === 0 ? <EmptyState message="추적 중인 주문 없음" textClass="text-ap-ink-3" />
        : (
          <Card>
            <CardHeader right={<span>{orders.length}건</span>}>주문 목록</CardHeader>
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
                      <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${STATUS_STYLE[o.status] ?? ""}`}>
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
                        <div className="text-ap-ink-3 text-[11px] mb-1">체결 이력 ({o.history.length}건)</div>
                        <div className="space-y-1">
                          {o.history.map((h, i) => (
                            <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 font-data text-[11px] text-ap-ink-3">
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
          </Card>
        )}
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
    <Card>
      <CardHeader right={<span>체결 {v.trades.length}건</span>}>{v.venue}</CardHeader>
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
                  <span className="ml-1 text-[10px] text-ap-caution" title="브로커 체결가 미제공 — 주문가로 추정">추정</span>
                )}
              </span>
              <span className={`font-data flex-1 text-right ${t.realized_pnl == null ? "text-ap-ink-3" : pnlColor(t.realized_pnl)}`}>
                {t.realized_pnl == null ? "—" : fmtPnl(t.realized_pnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
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
        : <div className="space-y-4">{venues.map(v => <VenueCard key={v.venue} v={v} />)}</div>}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("accounts");

  return (
    <div className="min-h-full bg-ap-bg">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 flex-wrap px-5 py-3 border-b border-ap-line bg-ap-bg/85 backdrop-blur">
        <div className="flex items-baseline gap-2.5">
          <span className="text-ap-ink-3 text-[9px] font-semibold tracking-[0.24em] uppercase">계좌현황 · 주문 · 손익</span>
          <span className="text-ap-ink-1 text-[13px] font-semibold tracking-wide">포트폴리오</span>
        </div>
        <SegmentedToggle
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { value: "accounts", label: "계좌 현황" },
            { value: "orders", label: "주문" },
            { value: "pnl", label: "손익" },
            { value: "optimizer", label: "최적화 도구" },
          ]}
        />
      </header>

      <div className="p-5">
        {tab === "accounts" && <AccountsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "pnl" && <PnlTab />}

        {tab === "optimizer" && (
          <div className="max-w-2xl mx-auto">
            <Card className="mb-4">
              <CardHeader>교육용 · 실전 배분 아님</CardHeader>
              <div className="p-4">
                <p className="text-ap-ink-2 text-xs leading-relaxed">
                  마코위츠 평균-분산 최적화는 교과서 방법. 노이즈 과적합·코너해·추정오차에 극불안정.
                  실제 배분엔 리스크패리티/상관 기반 방법이 더 강건.
                </p>
              </div>
            </Card>
            <a href="/portfolio/optimizer"
              className="block text-center py-3 border border-ap-line rounded-ap-lg text-ap-ink-3 text-sm hover:text-ap-ink-2 hover:border-ap-ink-3 transition-colors">
              최적화 도구 열기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
