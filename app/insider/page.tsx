"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  getInsiderKR,
  getInsiderUS,
  searchDartCompany,
  type DartCompany,
  type InsiderTrade,
} from "@/lib/api";
import { PageBanner } from "@/components/PageBanner";

type Market = "us" | "kr";
type TradeFilter = "all" | "BUY" | "SELL";
type MinValue = 0 | 10_000 | 50_000 | 100_000 | 500_000 | 1_000_000;

const MIN_VALUE_OPTS: { label: string; value: MinValue }[] = [
  { label: "제한없음", value: 0 },
  { label: "$10K+",   value: 10_000 },
  { label: "$50K+",   value: 50_000 },
  { label: "$100K+",  value: 100_000 },
  { label: "$500K+",  value: 500_000 },
  { label: "$1M+",    value: 1_000_000 },
];

const DAYS_OPTS = [7, 14, 30, 60, 90];

function fmt$(v: number | null | undefined, short = true): string {
  if (v == null) return "—";
  if (short) {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  }
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtShares(v: number | null | undefined): string {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function Badge({ type }: { type: string }) {
  if (type === "BUY")
    return (
      <span className="inline-block w-10 text-center text-[10px] font-bold rounded px-1 py-0.5 bg-pos/15 text-pos border border-pos/25">
        BUY
      </span>
    );
  if (type === "SELL")
    return (
      <span className="inline-block w-10 text-center text-[10px] font-bold rounded px-1 py-0.5 bg-neg/15 text-neg border border-neg/25">
        SELL
      </span>
    );
  return (
    <span className="inline-block w-10 text-center text-[10px] font-bold rounded px-1 py-0.5 bg-panel-2 text-text-3 border border-border">
      {type}
    </span>
  );
}

// ── US Table ──────────────────────────────────────────────────────────────────

function USTable({ trades }: { trades: InsiderTrade[] }) {
  if (trades.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">거래 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-panel-2">Filing</th>
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-panel-2">Trade</th>
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-panel-2">Ticker</th>
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-panel-2">Company</th>
            <th className="px-3 py-2 text-left font-medium sticky top-0 bg-panel-2">Insider</th>
            <th className="px-3 py-2 text-center font-medium sticky top-0 bg-panel-2">Type</th>
            <th className="px-3 py-2 text-right font-medium sticky top-0 bg-panel-2">Price</th>
            <th className="px-3 py-2 text-right font-medium sticky top-0 bg-panel-2">Qty</th>
            <th className="px-3 py-2 text-right font-medium sticky top-0 bg-panel-2">Value</th>
            <th className="px-3 py-2 text-right font-medium sticky top-0 bg-panel-2">Owned After</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isBuy = t.trade_type === "BUY";
            const isSell = t.trade_type === "SELL";
            return (
              <tr
                key={i}
                className={`border-t border-border transition-colors ${
                  isBuy ? "hover:bg-pos/5" : isSell ? "hover:bg-neg/5" : "hover:bg-panel-2"
                }`}
              >
                <td className="px-3 py-1.5 text-text-3 font-data whitespace-nowrap">{t.trade_date}</td>
                <td className="px-3 py-1.5 text-text-3 font-data whitespace-nowrap">{t.trade_date}</td>
                <td className="px-3 py-1.5 font-data font-semibold text-accent whitespace-nowrap">
                  {t.ticker ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-text-2 max-w-[160px] truncate">{t.issuer ?? "—"}</td>
                <td className="px-3 py-1.5 text-text-1 max-w-[140px] truncate">{t.reporter}</td>
                <td className="px-3 py-1.5 text-center">
                  <Badge type={t.trade_type} />
                </td>
                <td className="px-3 py-1.5 text-right font-data text-text-2 whitespace-nowrap">
                  {t.price_per_share != null ? `$${t.price_per_share.toFixed(2)}` : "—"}
                </td>
                <td className={`px-3 py-1.5 text-right font-data whitespace-nowrap ${isBuy ? "text-pos" : isSell ? "text-neg" : "text-text-2"}`}>
                  {fmtShares(t.shares)}
                </td>
                <td className={`px-3 py-1.5 text-right font-data font-medium whitespace-nowrap ${isBuy ? "text-pos" : isSell ? "text-neg" : "text-text-2"}`}>
                  {fmt$(t.value_usd)}
                </td>
                <td className="px-3 py-1.5 text-right font-data text-text-3 whitespace-nowrap">
                  {fmtShares(t.shares_owned_after)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── KR Table ──────────────────────────────────────────────────────────────────

function KRTable({ trades }: { trades: InsiderTrade[] }) {
  if (trades.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">거래 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium">접수일</th>
            <th className="px-3 py-2 text-left font-medium">종목코드</th>
            <th className="px-3 py-2 text-left font-medium">회사명</th>
            <th className="px-3 py-2 text-left font-medium">보고자</th>
            <th className="px-3 py-2 text-center font-medium">구분</th>
            <th className="px-3 py-2 text-right font-medium">증감 주식수</th>
            <th className="px-3 py-2 text-right font-medium">총 보유주식</th>
            <th className="px-3 py-2 text-right font-medium">지분율</th>
            <th className="px-3 py-2 text-left font-medium">보고구분</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isBuy = t.trade_type === "BUY";
            const isSell = t.trade_type === "SELL";
            const chg = t.shares_change ?? 0;
            return (
              <tr
                key={i}
                className={`border-t border-border transition-colors ${
                  isBuy ? "hover:bg-pos/5" : isSell ? "hover:bg-neg/5" : "hover:bg-panel-2"
                }`}
              >
                <td className="px-3 py-1.5 text-text-3 font-data whitespace-nowrap">{t.trade_date}</td>
                <td className="px-3 py-1.5 font-data font-semibold text-accent">{t.ticker ?? "—"}</td>
                <td className="px-3 py-1.5 text-text-2 max-w-[140px] truncate">{t.corp_name ?? "—"}</td>
                <td className="px-3 py-1.5 text-text-1 max-w-[120px] truncate">{t.reporter}</td>
                <td className="px-3 py-1.5 text-center">
                  <Badge type={t.trade_type} />
                </td>
                <td className={`px-3 py-1.5 text-right font-data font-medium whitespace-nowrap ${isBuy ? "text-pos" : isSell ? "text-neg" : "text-text-3"}`}>
                  {chg !== 0 ? `${chg > 0 ? "+" : ""}${chg.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-data text-text-2 whitespace-nowrap">
                  {fmtShares(t.shares_total)}
                </td>
                <td className="px-3 py-1.5 text-right font-data text-text-2">
                  {t.ownership_pct != null ? `${t.ownership_pct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-3 py-1.5 text-text-3 text-[10px]">{t.report_type ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ trades, market }: { trades: InsiderTrade[]; market: Market }) {
  const buys = trades.filter(t => t.trade_type === "BUY");
  const sells = trades.filter(t => t.trade_type === "SELL");
  const buyVal = buys.reduce((s, t) => s + (t.value_usd ?? 0), 0);
  const sellVal = sells.reduce((s, t) => s + (t.value_usd ?? 0), 0);

  return (
    <div className="flex flex-wrap gap-6 px-4 py-3 bg-panel-2 border-b border-border text-xs">
      <div>
        <span className="text-text-3 uppercase tracking-wider text-[10px]">총 건수</span>
        <span className="ml-2 text-text-1 font-data font-medium">{trades.length}</span>
      </div>
      <div>
        <span className="text-pos uppercase tracking-wider text-[10px]">매수 {buys.length}건</span>
        {market === "us" && <span className="ml-2 text-pos font-data font-medium">{fmt$(buyVal)}</span>}
      </div>
      <div>
        <span className="text-neg uppercase tracking-wider text-[10px]">매도 {sells.length}건</span>
        {market === "us" && <span className="ml-2 text-neg font-data font-medium">{fmt$(sellVal)}</span>}
      </div>
      {market === "us" && buyVal + sellVal > 0 && (
        <div>
          <span className="text-text-3 uppercase tracking-wider text-[10px]">Net</span>
          <span className={`ml-2 font-data font-medium ${buyVal - sellVal >= 0 ? "text-pos" : "text-neg"}`}>
            {buyVal - sellVal >= 0 ? "+" : ""}{fmt$(buyVal - sellVal)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── KR Company Picker ─────────────────────────────────────────────────────────

function KRCompanySearch({
  onSelect,
}: {
  onSelect: (corp: DartCompany) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DartCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);

  async function search() {
    if (!q.trim()) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    try {
      const res = await searchDartCompany(q.trim(), ctrl.signal);
      if (!ctrl.signal.aborted) setResults(res);
    } catch {
      /* ignore */
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => () => ctrlRef.current?.abort(), []);

  return (
    <div className="relative flex gap-2 items-center">
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={e => e.key === "Enter" && search()}
        placeholder="회사명 검색…"
        className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-xs w-44 focus:border-accent outline-none"
      />
      <button
        onClick={search}
        disabled={loading}
        className="bg-accent text-black text-xs px-3 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "…" : "검색"}
      </button>
      {results.length > 0 && (
        <div className="absolute top-8 left-0 z-20 bg-panel border border-border rounded-lg shadow-xl min-w-[220px] overflow-hidden">
          {results.slice(0, 8).map(c => (
            <button
              key={c.corp_code}
              onClick={() => { onSelect(c); setResults([]); setQ(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-panel-2 text-left border-t border-border first:border-0"
            >
              <span className="text-text-1 text-xs">{c.corp_name}</span>
              <span className="text-text-3 text-[10px] font-data ml-auto">{c.stock_code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsiderPage() {
  const [market, setMarket] = useState<Market>("us");
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>("all");
  const [minValue, setMinValue] = useState<MinValue>(0);
  const [days, setDays] = useState(7);
  const [tickerSearch, setTickerSearch] = useState("");

  // US state
  const [usTicker, setUsTicker] = useState("");
  const [usData, setUsData] = useState<InsiderTrade[]>([]);
  const [usLoading, setUsLoading] = useState(false);
  const [usError, setUsError] = useState<string | null>(null);

  // KR state
  const [krCorp, setKrCorp] = useState<DartCompany | null>(null);
  const [krData, setKrData] = useState<InsiderTrade[]>([]);
  const [krLoading, setKrLoading] = useState(false);
  const [krError, setKrError] = useState<string | null>(null);

  const usCtrl = useRef<AbortController | null>(null);
  const krCtrl = useRef<AbortController | null>(null);

  useEffect(() => () => { usCtrl.current?.abort(); krCtrl.current?.abort(); }, []);

  const fetchUS = useCallback(async (ticker: string, d: number) => {
    usCtrl.current?.abort();
    const ctrl = new AbortController();
    usCtrl.current = ctrl;
    setUsLoading(true); setUsError(null); setUsData([]);
    try {
      const res = await getInsiderUS(ticker.toUpperCase(), d, ctrl.signal);
      if (!ctrl.signal.aborted) setUsData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setUsError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setUsLoading(false);
    }
  }, []);

  const fetchKR = useCallback(async (corp: DartCompany, d: number) => {
    krCtrl.current?.abort();
    const ctrl = new AbortController();
    krCtrl.current = ctrl;
    setKrLoading(true); setKrError(null); setKrData([]);
    try {
      const res = await getInsiderKR(corp.corp_code, d, ctrl.signal);
      if (!ctrl.signal.aborted) setKrData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setKrError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setKrLoading(false);
    }
  }, []);

  // Filter logic
  const rawData = market === "us" ? usData : krData;
  const filtered = rawData.filter(t => {
    if (tradeFilter !== "all" && t.trade_type !== tradeFilter) return false;
    if (market === "us" && minValue > 0 && (t.value_usd ?? 0) < minValue) return false;
    if (tickerSearch) {
      const needle = tickerSearch.toUpperCase();
      const haystack = (market === "us"
        ? `${t.ticker ?? ""} ${t.issuer ?? ""}`
        : `${t.ticker ?? ""} ${t.corp_name ?? ""}`
      ).toUpperCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="p-4 space-y-4 max-w-full">
      <PageBanner pageKey="insider" />

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center bg-panel border border-border rounded-lg px-4 py-3">

        {/* Market tabs */}
        <div className="flex gap-0.5 mr-2">
          {(["us", "kr"] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                market === m
                  ? "bg-accent text-black"
                  : "text-text-3 hover:text-text-1 border border-border"
              }`}
            >
              {m === "us" ? "🇺🇸 US" : "🇰🇷 KR"}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Days */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-3 text-xs">기간:</span>
          {DAYS_OPTS.map(d => (
            <button
              key={d}
              onClick={() => {
                setDays(d);
                if (market === "us" && usTicker) fetchUS(usTicker, d);
                if (market === "kr" && krCorp) fetchKR(krCorp, d);
              }}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                days === d
                  ? "border border-accent text-accent bg-accent/10"
                  : "text-text-3 hover:text-text-1"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Trade type */}
        <div className="flex gap-0.5">
          {(["all", "BUY", "SELL"] as TradeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTradeFilter(f)}
              className={`px-2.5 py-0.5 text-[11px] rounded font-medium transition-colors ${
                tradeFilter === f
                  ? f === "BUY" ? "bg-pos/20 text-pos border border-pos/30"
                  : f === "SELL" ? "bg-neg/20 text-neg border border-neg/30"
                  : "border border-accent text-accent bg-accent/10"
                  : "text-text-3 hover:text-text-1 border border-transparent"
              }`}
            >
              {f === "all" ? "전체" : f}
            </button>
          ))}
        </div>

        {/* Min value (US only) */}
        {market === "us" && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-text-3 text-xs">최소금액:</span>
              <select
                value={minValue}
                onChange={e => setMinValue(Number(e.target.value) as MinValue)}
                className="bg-bg border border-border rounded px-2 py-0.5 text-text-1 text-xs"
              >
                {MIN_VALUE_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Ticker/name filter */}
        <div className="h-4 w-px bg-border mx-1" />
        <input
          value={tickerSearch}
          onChange={e => setTickerSearch(e.target.value)}
          placeholder={market === "us" ? "Ticker / Company 필터…" : "종목코드 / 회사명 필터…"}
          className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs w-44 focus:border-accent outline-none"
        />
      </div>

      {/* ── Search row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3">
        {market === "us" ? (
          <>
            <span className="text-text-3 text-xs shrink-0">티커 입력:</span>
            <input
              value={usTicker}
              onChange={e => setUsTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && usTicker && fetchUS(usTicker, days)}
              placeholder="AAPL, MSFT, NVDA…"
              className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-sm font-data w-36 focus:border-accent outline-none"
            />
            <button
              onClick={() => usTicker && fetchUS(usTicker, days)}
              disabled={usLoading || !usTicker}
              className="bg-accent text-black text-sm px-4 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-50"
            >
              {usLoading ? "조회 중…" : "조회"}
            </button>
            <p className="text-text-3 text-xs ml-auto">
              SEC EDGAR Form 4 · 공개시장 매수(P)/매도(S)만 표시
            </p>
          </>
        ) : (
          <>
            <span className="text-text-3 text-xs shrink-0">회사 검색:</span>
            <KRCompanySearch onSelect={corp => { setKrCorp(corp); fetchKR(corp, days); }} />
            {krCorp && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-text-1 text-sm font-medium">{krCorp.corp_name}</span>
                <span className="text-text-3 text-xs font-data">{krCorp.stock_code}</span>
                <button onClick={() => { setKrCorp(null); setKrData([]); }} className="text-text-3 text-xs hover:text-text-1 ml-2">
                  ✕
                </button>
              </div>
            )}
            <p className="text-text-3 text-xs ml-auto">
              OpenDART 임원·주요주주 소유보고서
            </p>
          </>
        )}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {market === "us" && usError && <p className="text-neg text-sm px-1">{usError}</p>}
      {market === "kr" && krError && <p className="text-neg text-sm px-1">{krError}</p>}

      {/* ── Loading hint ────────────────────────────────────────────────── */}
      {market === "us" && usLoading && (
        <p className="text-text-3 text-sm px-1">로딩 중… (EDGAR 응답 5~20초 소요)</p>
      )}
      {market === "kr" && krLoading && (
        <p className="text-text-3 text-sm px-1">로딩 중…</p>
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {filtered.length > 0 || rawData.length > 0 ? (
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <SummaryBar trades={filtered} market={market} />
          {market === "us" ? (
            <USTable trades={filtered} />
          ) : (
            <KRTable trades={filtered} />
          )}
          {rawData.length > 0 && filtered.length < rawData.length && (
            <div className="px-4 py-2 text-text-3 text-xs border-t border-border">
              필터 적용 결과: {filtered.length} / {rawData.length}건
            </div>
          )}
        </div>
      ) : (
        !usLoading && !krLoading && (rawData.length === 0) && (
          <div className="bg-panel border border-border rounded-lg p-12 text-center">
            <p className="text-text-3 text-sm">
              {market === "us" ? "티커를 입력하고 조회 버튼을 누르세요." : "회사명을 검색하고 선택하세요."}
            </p>
            <p className="text-text-3 text-xs mt-1">
              {market === "us"
                ? "예: AAPL, MSFT, NVDA, TSLA"
                : "예: 삼성전자, SK하이닉스, LG에너지솔루션"}
            </p>
          </div>
        )
      )}
    </div>
  );
}
