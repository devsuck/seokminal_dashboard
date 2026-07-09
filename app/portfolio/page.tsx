"use client";

import { useState, useEffect, useCallback } from "react";
import { getAccountBalances, getAlpacaPositions, getAlpacaAccount, getPaperState, type AccountRow, type AlpacaPosition, type AlpacaAccount, type PaperState } from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";

type Tab = "accounts" | "optimizer";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function fmt(v: number | null, ccy: string, compact = false): string {
  if (v == null) return "—";
  const locale = ccy === "KRW" ? "ko-KR" : "en-US";
  const symbol = ccy === "KRW" ? "₩" : ccy === "EUR" ? "€" : "$";
  if (compact && Math.abs(v) >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(v) >= 1_000) return `${symbol}${(v / 1_000).toFixed(1)}K`;
  return `${symbol}${v.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
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
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full text-left">
        <div className="flex items-center gap-3 px-4 py-3">
          <StatusDot ok={ok} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-text-1 text-sm font-medium">{label}</span>
              <ModeChip mode={mode} paper={paper} />
            </div>
            {error ? (
              <p className="text-neg text-[10px] mt-0.5 truncate">{error.slice(0, 80)}</p>
            ) : (
              <p className="text-text-3 text-[10px] mt-0.5">{ccy}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-base font-mono font-semibold ${ok ? "text-text-1" : "text-text-3"}`}>
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
  const flag = ccy === "KRW" ? "🇰🇷" : ccy === "EUR" ? "🇪🇺" : "🇺🇸";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <span className="text-text-2 text-sm font-semibold">{ccy}</span>
        </div>
        {total != null && (
          <span className="text-text-1 text-sm font-mono font-semibold">{fmt(total, ccy)}</span>
        )}
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [alpacaPositions, setAlpacaPositions] = useState<AlpacaPosition[]>([]);
  const [alpacaAcct, setAlpacaAcct] = useState<AlpacaAccount | null>(null);
  const [paper, setPaper] = useState<PaperState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    // Fast: Alpaca + LKG paper — show UI immediately
    Promise.allSettled([
      getAlpacaAccount(),
      getAlpacaPositions(),
      getPaperState(),
    ]).then(([acctRes, posRes, paperRes]) => {
      if (acctRes.status === "fulfilled") setAlpacaAcct(acctRes.value);
      if (posRes.status === "fulfilled") setAlpacaPositions(posRes.value);
      if (paperRes.status === "fulfilled") setPaper(paperRes.value);
      setLoading(false);
    });
    // Slow: full balances (KIS can take 30s+) — abort after 20s
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 20_000);
    getAccountBalances(ctrl.signal)
      .then(r => setAccounts(r.accounts))
      .catch(() => {})
      .finally(() => clearTimeout(tid));
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  // 통화별 분류
  const usdAccounts = accounts.filter(a => a.ccy === "USD");
  const krwAccounts = accounts.filter(a => a.ccy === "KRW");
  const eurAccounts = accounts.filter(a => a.ccy === "EUR");

  const lkgBalance = paper ? paper.cash + paper.positions.reduce((s, p) => s + p.value, 0) : null;

  // USD total: fast Alpaca + LKG + any other USD accounts from slow source
  const otherUsd = usdAccounts.filter(a => a.venue !== "alpaca").reduce((s, a) => s + (a.balance ?? 0), 0);
  const usdTotal = (alpacaAcct?.portfolio_value ?? 0) + (lkgBalance ?? 0) + otherUsd;

  const krwTotal = krwAccounts.every(a => a.balance == null) ? null
    : krwAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 px-5 py-3 border-b border-border flex items-center justify-between">
        <h1 className="text-text-1 font-semibold text-sm">
          <span className="text-accent">포트폴리오</span>
          <span className="text-text-3 text-xs ml-2 font-normal">연동 계좌 · 통화별 현황</span>
        </h1>
        <div className="flex gap-1">
          {([["accounts", "계좌 현황"], ["optimizer", "최적화 도구"]] as [Tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                tab === t ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-text-2"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 바디 */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "accounts" && (
          <div className="max-w-2xl mx-auto space-y-8">
            {loading ? (
              <p className="text-text-3 text-sm text-center py-12">로딩 중…</p>
            ) : (
              <>
                {/* USD */}
                <CcySection ccy="USD" total={usdTotal > 0 ? usdTotal : null}>
                  {/* Alpaca: 빠른 직접 로드 */}
                  {alpacaAcct && (
                    <AccountCard label="Alpaca · 미국주식" ccy="USD"
                      balance={alpacaAcct.portfolio_value} paper={alpacaAcct.paper}>
                      <AlpacaPositions positions={alpacaPositions} />
                    </AccountCard>
                  )}
                  {/* 느린 accounts에서 non-alpaca USD만 */}
                  {usdAccounts.filter(a => a.venue !== "alpaca").map(a => (
                    <AccountCard key={a.venue} label={a.label} ccy="USD"
                      balance={a.balance} mode={a.mode} error={a.error} />
                  ))}

                  {/* LKG Paper Trading 별도 카드 */}
                  {paper && (
                    <AccountCard label="LKG 페이퍼 트레이딩" ccy="USD"
                      balance={lkgBalance} paper={true}>
                      <LkgPaperDetail paper={paper} />
                    </AccountCard>
                  )}
                </CcySection>

                {/* KRW */}
                <CcySection ccy="KRW" total={krwTotal}>
                  {krwAccounts.map(a => (
                    <AccountCard key={a.venue} label={a.label} ccy="KRW"
                      balance={a.balance} mode={a.mode} error={a.error} />
                  ))}
                  {krwAccounts.length === 0 && (
                    <p className="text-text-3 text-xs">KRW 계좌 없음</p>
                  )}
                </CcySection>

                {/* EUR */}
                {eurAccounts.length > 0 && (
                  <CcySection ccy="EUR" total={eurAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)}>
                    {eurAccounts.map(a => (
                      <AccountCard key={a.venue} label={a.label} ccy="EUR"
                        balance={a.balance} mode={a.mode} error={a.error} />
                    ))}
                  </CcySection>
                )}
              </>
            )}
          </div>
        )}

        {tab === "optimizer" && (
          <div className="max-w-2xl mx-auto">
            <Panel className="mb-4">
              <PanelHeader>교육용 · 실전 배분 아님</PanelHeader>
              <div className="p-4">
                <p className="text-text-2 text-xs leading-relaxed">
                  마코위츠 평균-분산 최적화는 교과서 방법. 노이즈 과적합·코너해·추정오차에 극불안정.
                  실제 배분엔 리스크패리티/상관 기반 방법이 더 강건.
                </p>
              </div>
            </Panel>
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
