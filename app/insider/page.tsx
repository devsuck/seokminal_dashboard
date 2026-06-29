"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  searchDartCompany,
  getInsiderKR,
  getInsiderUS,
  type DartCompany,
  type InsiderTrade,
} from "@/lib/api";
import { PageBanner } from "@/components/PageBanner";

type Tab = "kr" | "us";
type DaysOption = 30 | 90 | 180 | 365;

function TradeTypeBadge({ type }: { type: string }) {
  if (type === "BUY")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-pos/10 text-pos border border-pos/20">
        매수
      </span>
    );
  if (type === "SELL")
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-neg/10 text-neg border border-neg/20">
        매도
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-panel-2 text-text-3 border border-border">
      {type}
    </span>
  );
}

function fmt$(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtShares(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function TradesTable({ trades, market }: { trades: InsiderTrade[]; market: "kr" | "us" }) {
  if (trades.length === 0)
    return <p className="text-text-3 text-sm p-4">데이터 없음</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">일자</th>
            <th className="text-left px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">보고자</th>
            <th className="text-left px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">구분</th>
            {market === "kr" ? (
              <>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">증감 주식수</th>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">보유 주식수</th>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">지분율</th>
                <th className="text-left px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">보고구분</th>
              </>
            ) : (
              <>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">주식수</th>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">단가</th>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">거래금액</th>
                <th className="text-right px-4 py-2 text-text-3 text-[10px] uppercase tracking-wider">보유후 주식수</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
              <td className="px-4 py-2 text-text-3 font-data">{t.trade_date}</td>
              <td className="px-4 py-2 text-text-1">{t.reporter}</td>
              <td className="px-4 py-2">
                <TradeTypeBadge type={t.trade_type} />
              </td>
              {market === "kr" ? (
                <>
                  <td className={`px-4 py-2 text-right font-data ${
                    (t.shares_change ?? 0) > 0 ? "text-pos" :
                    (t.shares_change ?? 0) < 0 ? "text-neg" : "text-text-3"
                  }`}>
                    {t.shares_change != null
                      ? `${t.shares_change > 0 ? "+" : ""}${t.shares_change.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-text-2">
                    {fmtShares(t.shares_total)}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-text-2">
                    {t.ownership_pct != null ? `${t.ownership_pct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-text-3 text-[10px]">{t.report_type ?? "—"}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-2 text-right font-data text-text-2">
                    {fmtShares(t.shares)}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-text-2">
                    {t.price_per_share != null ? `$${t.price_per_share.toFixed(2)}` : "—"}
                  </td>
                  <td className={`px-4 py-2 text-right font-data ${
                    t.trade_type === "BUY" ? "text-pos" : t.trade_type === "SELL" ? "text-neg" : "text-text-2"
                  }`}>
                    {fmt$(t.value_usd)}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-text-3">
                    {fmtShares(t.shares_owned_after)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── KR Tab ────────────────────────────────────────────────────────────────────

function KRInsiderTab() {
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<DartCompany[]>([]);
  const [selected, setSelected] = useState<DartCompany | null>(null);
  const [days, setDays] = useState<DaysOption>(180);
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchCtrl = useRef<AbortController | null>(null);
  const tradeCtrl = useRef<AbortController | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    searchCtrl.current?.abort();
    const ctrl = new AbortController();
    searchCtrl.current = ctrl;
    setSearching(true);
    setCompanies([]);
    setSelected(null);
    setTrades([]);
    try {
      const res = await searchDartCompany(query.trim(), ctrl.signal);
      if (!ctrl.signal.aborted) setCompanies(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(err instanceof ApiError ? err.message : "검색 실패");
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  }

  async function handleSelect(corp: DartCompany) {
    setSelected(corp);
    setCompanies([]);
    tradeCtrl.current?.abort();
    const ctrl = new AbortController();
    tradeCtrl.current = ctrl;
    setLoading(true);
    setError(null);
    setTrades([]);
    try {
      const res = await getInsiderKR(corp.corp_code, days, ctrl.signal);
      if (!ctrl.signal.aborted) setTrades(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(err instanceof ApiError ? err.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  // re-fetch when days changes and a company is selected
  useEffect(() => {
    if (!selected) return;
    handleSelect(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useEffect(() => {
    return () => {
      searchCtrl.current?.abort();
      tradeCtrl.current?.abort();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          placeholder="회사명 검색 (예: 삼성전자)"
          className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-sm flex-1 focus:border-accent outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {searching ? "검색 중…" : "검색"}
        </button>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value) as DaysOption)}
          className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
        >
          <option value={30}>30일</option>
          <option value={90}>90일</option>
          <option value={180}>180일</option>
          <option value={365}>1년</option>
        </select>
      </div>

      {/* Company list */}
      {companies.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          {companies.map(c => (
            <button
              key={c.corp_code}
              onClick={() => handleSelect(c)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-panel-2 transition-colors text-left border-t border-border first:border-0"
            >
              <span className="text-text-1 text-sm">{c.corp_name}</span>
              <span className="text-text-3 text-xs font-data">{c.stock_code}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected company */}
      {selected && (
        <div className="flex items-center gap-2">
          <span className="text-text-1 text-sm font-medium">{selected.corp_name}</span>
          <span className="text-text-3 text-xs font-data">{selected.stock_code}</span>
          <button
            onClick={() => { setSelected(null); setTrades([]); }}
            className="text-text-3 text-xs hover:text-text-1 ml-auto"
          >
            ✕ 초기화
          </button>
        </div>
      )}

      {error && <p className="text-neg text-sm">{error}</p>}

      {loading && <p className="text-text-3 text-sm">로딩 중…</p>}

      {selected && !loading && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <TradesTable trades={trades} market="kr" />
        </div>
      )}
    </div>
  );
}

// ── US Tab ────────────────────────────────────────────────────────────────────

function USInsiderTab() {
  const [ticker, setTicker] = useState("AAPL");
  const [days, setDays] = useState<DaysOption>(90);
  const [trades, setTrades] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { ctrlRef.current?.abort(); };
  }, []);

  async function fetchTrades() {
    if (!ticker.trim()) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError(null);
    setTrades([]);
    try {
      const res = await getInsiderUS(ticker.trim().toUpperCase(), days, ctrl.signal);
      if (!ctrl.signal.aborted) setTrades(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setError(err instanceof ApiError ? err.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && fetchTrades()}
          placeholder="Ticker (예: AAPL, MSFT, NVDA)"
          className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-sm w-48 font-data focus:border-accent outline-none"
        />
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value) as DaysOption)}
          className="bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-sm"
        >
          <option value={30}>30일</option>
          <option value={90}>90일</option>
          <option value={180}>180일</option>
          <option value={365}>1년</option>
        </select>
        <button
          onClick={fetchTrades}
          disabled={loading}
          className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "조회 중…" : "조회"}
        </button>
      </div>

      <p className="text-text-3 text-xs">
        SEC EDGAR Form 4 기반 · 공개시장 매수(P) / 매도(S)만 표시 · 권리행사·세금원천징수 제외
      </p>

      {error && <p className="text-neg text-sm">{error}</p>}
      {loading && <p className="text-text-3 text-sm">로딩 중… (EDGAR 응답 5~15초 소요)</p>}

      {trades.length > 0 && (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          {/* Summary */}
          <div className="flex gap-6 px-4 py-3 border-b border-border">
            {(["BUY", "SELL"] as const).map(type => {
              const subset = trades.filter(t => t.trade_type === type);
              const total = subset.reduce((s, t) => s + (t.value_usd ?? 0), 0);
              return (
                <div key={type}>
                  <p className={`text-[10px] uppercase tracking-wider ${type === "BUY" ? "text-pos" : "text-neg"}`}>
                    {type === "BUY" ? "매수" : "매도"} ({subset.length}건)
                  </p>
                  <p className={`text-sm font-data font-medium ${type === "BUY" ? "text-pos" : "text-neg"}`}>
                    {fmt$(total)}
                  </p>
                </div>
              );
            })}
          </div>
          <TradesTable trades={trades} market="us" />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsiderPage() {
  const [tab, setTab] = useState<Tab>("us");

  return (
    <div className="p-6 space-y-5 max-w-[900px]">
      <PageBanner pageKey="insider" />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border">
        {(["us", "kr"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent bg-accent/10"
                : "border-transparent text-text-3 hover:text-text-1"
            }`}
          >
            {t === "us" ? "🇺🇸 US (SEC EDGAR)" : "🇰🇷 KR (OpenDART)"}
          </button>
        ))}
      </div>

      {tab === "us" && <USInsiderTab />}
      {tab === "kr" && <KRInsiderTab />}
    </div>
  );
}
