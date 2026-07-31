"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, getHLPositions, getKisHoldings,
  getOmsOrders, getRealizedPnl, ApiError,
  type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState, type HLAssetPosition, type KISHolding,
  type OmsOrder, type VenuePnl,
} from "@/lib/api";
import { Panel as UiPanel, PanelHeader } from "@/components/ui/Panel";
import { SegmentedToggle, LoadingState, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/console/widgets";
import { Panel, PanelHead } from "@/components/console/primitives";
import { FinancialMetric, TerminalTable } from "@/components/terminal";
import { TimeSeries, type TSSeries } from "@/components/charts/TimeSeries";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { TOKEN } from "@/lib/chart-colors";

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
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${isPaper ? "bg-warn/10 text-warn" : "bg-pos/10 text-pos"}`}>
      {isPaper ? "페이퍼" : "실계좌"}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? "bg-pos" : "bg-neg"}`} />;
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
    <div className="bg-panel border border-border rounded-xl overflow-hidden hover:border-text-3 transition-colors">
      <button onClick={() => setOpen(v => !v)} className="w-full text-left hover:bg-panel-2 transition-colors">
        <div className="flex items-center gap-3 px-4 py-3">
          <StatusDot ok={ok} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-text-1 text-sm font-semibold">{label}</span>
              <ModeChip mode={mode} paper={paper} />
            </div>
            {error ? (
              <p className="text-neg text-[10px] mt-0.5 truncate">{error.slice(0, 80)}</p>
            ) : (
              <p className="text-text-3 text-[10px] mt-0.5">{ccy}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-mono font-bold ${ok ? "text-text-1" : "text-text-3"}`}>
              {fmt(balance, ccy)}
            </p>
          </div>
          {children && (
            <span className="text-text-3 text-xs ml-1">{open ? "▲" : "▼"}</span>
          )}
        </div>
      </button>
      {open && children && (
        <div className="border-t border-border px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── 알파카 포지션 인라인 ─────────────────────────────────────────────────────

function AlpacaPositions({ positions }: { positions: AlpacaPosition[] }) {
  if (positions.length === 0) return <p className="text-text-3 text-xs">포지션 없음</p>;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-text-3 text-[10px] border-b border-border">
          {["종목", "방향", "수량", "평단가", "현재가", "평가손익"].map(h => (
            <th key={h} className="pb-1.5 text-left font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map(p => (
          <tr key={p.symbol} className="border-b border-border/30">
            <td className="py-1 text-text-1 font-medium">{p.symbol}</td>
            <td className="py-1">
              <span className={`text-[9px] px-1 py-0.5 rounded ${p.side === "long" ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
                {p.side.toUpperCase()}
              </span>
            </td>
            <td className="py-1 font-mono text-text-2">{p.qty}</td>
            <td className="py-1 font-mono text-text-2">${p.avg_entry_price.toFixed(2)}</td>
            <td className="py-1 font-mono text-text-2">${p.current_price.toFixed(2)}</td>
            <td className={`py-1 font-mono px-1 font-bold ${p.unrealized_pl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
              {p.unrealized_pl >= 0 ? "+" : ""}${p.unrealized_pl.toFixed(2)}
              <span className="text-text-3 ml-1 font-normal">({(p.unrealized_plpc * 100).toFixed(1)}%)</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Hyperliquid 포지션 인라인 ────────────────────────────────────────────────

function HLPositions({ positions }: { positions: HLAssetPosition[] }) {
  if (positions.length === 0) return <p className="text-text-3 text-xs">포지션 없음</p>;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-text-3 text-[10px] border-b border-border">
          {["코인", "방향", "수량", "진입가", "평가액", "미실현손익"].map(h => (
            <th key={h} className="pb-1.5 text-left font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map(p => {
          const pos = p.position;
          const szi = parseFloat(pos.szi);
          const isLong = szi >= 0;
          const pnl = parseFloat(pos.unrealizedPnl);
          const roe = parseFloat(pos.returnOnEquity) * 100;
          return (
            <tr key={pos.coin} className="border-b border-border/30">
              <td className="py-1 text-text-1 font-medium">{pos.coin}</td>
              <td className="py-1">
                <span className={`text-[9px] px-1 py-0.5 rounded ${isLong ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
                  {isLong ? "롱" : "숏"}
                </span>
              </td>
              <td className="py-1 font-mono text-text-2">{Math.abs(szi)}</td>
              <td className="py-1 font-mono text-text-2">{pos.entryPx ? `$${parseFloat(pos.entryPx).toFixed(2)}` : "—"}</td>
              <td className="py-1 font-mono text-text-2">${parseFloat(pos.positionValue).toFixed(2)}</td>
              <td className={`py-1 font-mono px-1 font-bold ${pnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                <span className="text-text-3 ml-1 font-normal">({roe.toFixed(1)}%)</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── KIS(한투) 보유종목 인라인 ─────────────────────────────────────────────────

function KISHoldings({ holdings }: { holdings: KISHolding[] }) {
  if (holdings.length === 0) return <p className="text-text-3 text-xs">보유 종목 없음</p>;
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="text-text-3 text-[10px] border-b border-border">
          {["종목", "수량", "평단가", "현재가", "평가손익"].map(h => (
            <th key={h} className="pb-1.5 text-left font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {holdings.map(h => (
          <tr key={h.code} className="border-b border-border/30">
            <td className="py-1 text-text-1 font-medium">{h.name}</td>
            <td className="py-1 font-mono text-text-2">{h.qty}</td>
            <td className="py-1 font-mono text-text-2">₩{h.avg_price.toLocaleString("ko-KR")}</td>
            <td className="py-1 font-mono text-text-2">₩{h.current.toLocaleString("ko-KR")}</td>
            <td className={`py-1 font-mono px-1 font-bold ${(h.return_pct ?? 0) >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
              {h.return_pct != null ? `${h.return_pct >= 0 ? "+" : ""}${h.return_pct.toFixed(1)}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── LKG Paper Trading 인라인 ─────────────────────────────────────────────────

function LkgPaperDetail({ paper }: { paper: PaperState }) {
  const totalPnl = paper.closed.reduce((s, c) => s + c.pnl, 0);
  if (paper.positions.length === 0 && paper.closed.length === 0)
    return <p className="text-text-3 text-xs">포지션 없음 — AI 업데이트 시 자동 진입</p>;
  return (
    <div className="space-y-3">
      {paper.positions.length > 0 && (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-text-3 text-[10px] border-b border-border">
              {["종목", "방향", "진입가", "평가금액", "병목Δ"].map(h => (
                <th key={h} className="pb-1.5 text-left font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paper.positions.map(p => (
              <tr key={p.node_id} className="border-b border-border/30">
                <td className="py-1 text-text-1 font-medium">{p.symbol}</td>
                <td className="py-1">
                  <span className={`text-[9px] px-1 py-0.5 rounded ${p.side === "BUY" ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
                    {p.side}
                  </span>
                </td>
                <td className="py-1 font-mono text-text-2">${p.entry_price.toFixed(2)}</td>
                <td className="py-1 font-mono text-text-2">${p.value.toLocaleString()}</td>
                <td className={`py-1 font-mono px-1 font-bold ${p.score_delta > 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                  {p.score_delta > 0 ? "+" : ""}{p.score_delta.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {paper.closed.length > 0 && (
        <div className="pt-1">
          <p className="text-text-3 text-[10px] mb-1">실현 손익: <span className={`font-mono px-1 font-bold ${totalPnl >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</span></p>
        </div>
      )}
    </div>
  );
}

// ── 섹션 헤더 ────────────────────────────────────────────────────────────────

function CcySection({ ccy, total, children }: { ccy: string; total: number | null; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-text-1 text-xs font-bold font-mono tracking-widest bg-panel-2 border border-border rounded px-2 py-1">
          {ccy}
        </span>
        {total != null && (
          <span className="text-accent text-base font-mono font-bold">{fmt(total, ccy)}</span>
        )}
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ── Composition row (venue → currency 배분표, 표시만 · 실제 잔고 재사용) ──────

interface CompositionRow { venue: string; ccy: string; balance: number; share: number }

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
      .finally(() => clearTimeout(tid));
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

  if (loading) return <p className="text-text-3 text-sm text-center py-12">로딩 중…</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-4 items-start">
      {/* LEFT — currency totals, quick nav */}
      <div className="space-y-3">
        <FinancialMetric label="USD 합계" value={usdTotal} format="currency" precision={0} size="md" />
        {krwTotal != null && <FinancialMetric label="KRW 합계" value={krwTotal} format="currency" precision={0} size="md" />}
        {eurTotal != null && <FinancialMetric label="EUR 합계" value={eurTotal} format="currency" precision={0} size="md" />}
        {usdcTotal != null && <FinancialMetric label="USDC 합계" value={usdcTotal} format="currency" precision={0} size="md" />}
      </div>

      {/* CENTER — account cards by currency, main workspace */}
      <div className="space-y-8 min-w-0">
        <CcySection ccy="USD" total={usdTotal > 0 ? usdTotal : null}>
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

        <CcySection ccy="KRW" total={krwTotal}>
          {krwAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="KRW"
              balance={a.balance} mode={a.mode} error={a.error}>
              <KISHoldings holdings={a.venue === "kis_mock" ? kisMockHoldings : kisLiveHoldings} />
            </AccountCard>
          ))}
          {krwAccounts.length === 0 && (
            <p className="text-text-3 text-xs">KRW 계좌 없음</p>
          )}
        </CcySection>

        {eurAccounts.length > 0 && (
          <CcySection ccy="EUR" total={eurTotal}>
            {eurAccounts.map(a => (
              <AccountCard key={a.venue} label={a.label} ccy="EUR"
                balance={a.balance} mode={a.mode} error={a.error} />
            ))}
          </CcySection>
        )}

        <CcySection ccy="USDC" total={usdcTotal}>
          {usdcAccounts.map(a => (
            <AccountCard key={a.venue} label={a.label} ccy="USDC"
              balance={a.balance} mode={a.mode} error={a.error}>
              <HLPositions positions={a.venue === "hl_testnet" ? hlTestnetPositions : hlMainnetPositions} />
            </AccountCard>
          ))}
          {usdcAccounts.length === 0 && (
            <p className="text-text-3 text-xs">Hyperliquid 계좌 없음</p>
          )}
        </CcySection>
      </div>

      {/* RIGHT — composition (venue → 통화별 잔고 구성비) */}
      <Panel>
        <PanelHead kicker="구성" title="거래소별 분포" />
        <div className="p-2">
          {compositionRows.length === 0 ? (
            <p className="text-[var(--c-text-3)] text-xs p-2">연동 계좌 없음</p>
          ) : (
            <TerminalTable
              dense
              rows={compositionRows}
              keyFn={(r) => `${r.venue}-${r.ccy}`}
              defaultSort={{ key: "balance", dir: "desc" }}
              columns={[
                { key: "venue", label: "거래소" },
                { key: "ccy", label: "통화" },
                { key: "balance", label: "잔고", align: "r", sortable: true, render: (r) => fmt(r.balance, r.ccy, true) },
                { key: "share", label: "비중", align: "r", sortable: true, render: (r) => `${(r.share * 100).toFixed(1)}%` },
              ]}
            />
          )}
        </div>
        <p className="px-3 pb-3 text-[10px] text-[var(--c-text-3)] leading-relaxed">
          통화 내 venue 잔고 구성비 · 손익 귀속(attribution)이 아닌 배분 현황 표시.
        </p>
      </Panel>
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
  OPEN: "text-info bg-info/10 border-info/30",
  PARTIALLY_FILLED: "text-warn bg-warn/10 border-warn/30",
  FILLED: "text-pos bg-pos/10 border-pos/30",
  CANCELLED: "text-text-3 bg-panel-2 border-border",
  REJECTED: "text-neg bg-neg/10 border-neg/30",
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
      <p className="text-text-3 text-sm">
        제출된 주문의 실시간 상태 · 부분체결 진행. 서버 프로세스 재시작 시 초기화됨(영구 기록은 <span className="font-data">/orders/audit</span>).
      </p>

      <div className="flex gap-2 text-xs">
        <SegmentedToggle
          value={venue}
          onChange={setVenue}
          size="sm"
          options={VENUES.map(v => ({ value: v, label: VENUE_LABEL[v] ?? v }))}
        />
        <div className="w-px bg-border" />
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded border ${status === s ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-1"}`}>
              {STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="주문 상태 로딩 중…" />
        : !orders || orders.length === 0 ? <EmptyState message="추적 중인 주문 없음" />
        : (
          <Panel>
            <PanelHeader right={<span className="text-text-3">{orders.length}건</span>}>주문 목록</PanelHeader>
            <div className="divide-y divide-border/50 text-sm">
              {orders.map(o => {
                const key = `${o.venue}:${o.order_id}`;
                const total = o.filled + o.remaining;
                const pct = total > 0 ? Math.round((o.filled / total) * 100) : 0;
                return (
                  <div key={key}>
                    <button
                      onClick={() => setExpanded(expanded === key ? null : key)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-panel-2"
                    >
                      <span className="text-text-3 w-24 shrink-0 font-data">{o.venue}</span>
                      <span className="text-text-1 w-28 shrink-0 font-data truncate">{o.order_id}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${STATUS_STYLE[o.status] ?? ""}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <div className="flex-1 h-1.5 bg-panel-2 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-text-3 font-data w-28 text-right shrink-0">
                        {o.filled}/{total} ({pct}%)
                      </span>
                      <span className="text-text-3 font-data w-40 text-right shrink-0">{fmtTs(o.updated_ts)}</span>
                    </button>
                    {expanded === key && (
                      <div className="px-4 pb-3 pl-[7.5rem]">
                        <div className="text-text-3 text-[11px] mb-1">체결 이력 ({o.history.length}건)</div>
                        <div className="space-y-1">
                          {o.history.map((h, i) => (
                            <div key={i} className="flex gap-3 font-data text-[11px] text-text-3">
                              <span className="w-40 shrink-0">{fmtTs(h.ts)}</span>
                              <span className={`w-28 shrink-0 ${STATUS_STYLE[h.status]?.split(" ")[0] ?? ""}`}>{STATUS_LABEL[h.status] ?? h.status}</span>
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
          </Panel>
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
  return v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-text-3";
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
    <Panel>
      <PanelHeader right={<span className="text-text-3">체결 {v.trades.length}건</span>}>{v.venue}</PanelHeader>
      <div className="p-4 grid grid-cols-3 gap-4 text-sm border-b border-border/50">
        <div>
          <div className="text-text-3 text-xs mb-0.5">총 실현손익</div>
          <div className={`font-data text-base ${pnlColor(v.gross_realized_pnl)}`}>{fmtPnl(v.gross_realized_pnl)}</div>
        </div>
        <div>
          <div className="text-text-3 text-xs mb-0.5">수수료(설정값, 추정)</div>
          <div className="font-data text-base text-text-2">-{v.fees.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-text-3 text-xs mb-0.5">순 실현손익</div>
          <div className={`font-data text-base font-semibold ${pnlColor(v.net_realized_pnl)}`}>{fmtPnl(v.net_realized_pnl)}</div>
        </div>
      </div>

      {v.unpriced_fills > 0 && (
        <div className="px-4 py-2 text-xs text-warn bg-warn/10 border-b border-warn/30">
          체결가 미확인 주문 {v.unpriced_fills}건 — 손익 계산에서 제외됨
        </div>
      )}

      {pnlCurve.length > 0 && (
        <div className="p-3 border-b border-border/50">
          <ChartFrame title="누적 실현손익 추이" caption="체결 원장 누적합(총액, 수수료 전)">
            <TimeSeries series={pnlCurve} height={160} yFormat={(x) => x.toFixed(0)} />
          </ChartFrame>
        </div>
      )}

      {v.open_positions.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="text-text-3 text-xs mb-1.5">보유 포지션</div>
          <div className="space-y-1 text-sm font-data">
            {v.open_positions.map(p => (
              <div key={p.symbol} className="flex gap-3 text-text-1">
                <span className="w-24 shrink-0">{p.symbol}</span>
                <span className="text-text-3">{p.qty} @ {p.avg_price}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.trades.length > 0 && (
        <div className="divide-y divide-border/50 text-sm">
          {v.trades.map((t, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-3">
              <span className="text-text-3 w-40 shrink-0 font-data">{fmtTs(t.ts)}</span>
              <span className="text-text-1 w-24 shrink-0 font-data">{t.symbol}</span>
              <span className={`w-12 shrink-0 font-data ${t.side === "buy" ? "text-pos" : "text-neg"}`}>{t.side}</span>
              <span className="text-text-3 font-data w-20 shrink-0">{t.qty}주</span>
              <span className="text-text-1 font-data w-24 shrink-0">
                {t.price}
                {t.price_source === "estimated" && (
                  <span className="ml-1 text-[10px] text-warn" title="브로커 체결가 미제공 — 주문가로 추정">추정</span>
                )}
              </span>
              <span className={`font-data flex-1 text-right ${t.realized_pnl == null ? "text-text-3" : pnlColor(t.realized_pnl)}`}>
                {t.realized_pnl == null ? "—" : fmtPnl(t.realized_pnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
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
      <p className="text-text-3 text-sm">
        OMS 체결 기록 FIFO 매칭. KR 체결가는 브로커가 제공 안 해서 주문가로 추정 표시(<span className="text-warn">추정</span> 배지).
        수수료는 실 브로커 커미션이 아니라 설정한 bps 추정값(<span className="font-data">PNL_FEE_BPS_*</span> 환경변수, 기본 0).
      </p>

      {error ? <div className="text-neg text-sm bg-neg/10 border border-neg/30 rounded px-3 py-2">{error}</div>
        : loading ? <LoadingState message="손익 계산 중…" />
        : !venues || venues.length === 0 ? <EmptyState message="체결된 주문 없음" />
        : <div className="space-y-4">{venues.map(v => <VenueCard key={v.venue} v={v} />)}</div>}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("accounts");

  return (
    <div className="min-h-full">
      <PageHeader kicker="계좌현황 · 주문 · 손익" title="포트폴리오"
        right={
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
        } />

      <div className="p-5">
        {tab === "accounts" && <AccountsTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "pnl" && <PnlTab />}

        {tab === "optimizer" && (
          <div className="max-w-2xl mx-auto">
            <UiPanel className="mb-4">
              <PanelHeader>교육용 · 실전 배분 아님</PanelHeader>
              <div className="p-4">
                <p className="text-text-2 text-xs leading-relaxed">
                  마코위츠 평균-분산 최적화는 교과서 방법. 노이즈 과적합·코너해·추정오차에 극불안정.
                  실제 배분엔 리스크패리티/상관 기반 방법이 더 강건.
                </p>
              </div>
            </UiPanel>
            <a href="/portfolio/optimizer"
              className="block text-center py-3 border border-border rounded-xl text-text-3 text-sm hover:text-text-2 hover:border-text-3 transition-colors">
              최적화 도구 열기 →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
