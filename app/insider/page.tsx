"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  getInsiderKR,
  getInsiderKRRecent,
  getInsiderKRReportLag,
  getInsiderUS,
  getInsiderUSRecent,
  getInsiderCongress,
  getGovContracts,
  getOptionsUOA,
  searchDartCompany,
  type DartCompany,
  type InsiderTrade,
  type InsiderTradeType,
  type CongressTrade,
  type GovContract,
  type OptionsUOA,
} from "@/lib/api";
import { Panel } from "@/components/ui/Panel";
import { Button, SegmentedToggle } from "@/components/ui";

type Market = "us" | "kr" | "congress" | "gov" | "options";
type TradeFilter = "all" | "BUY" | "SELL" | "CORP_ACTION" | "HOLD_REPORT";
type MinValue = 0 | 10_000 | 50_000 | 100_000 | 500_000 | 1_000_000;

const KR_TRADE_FILTER_OPTS: { value: TradeFilter; label: string }[] = [
  { value: "all",         label: "전체" },
  { value: "BUY",         label: "매수" },
  { value: "SELL",        label: "매도" },
  { value: "CORP_ACTION", label: "기업행위" },  // 무상증자/유상증자/소각
  { value: "HOLD_REPORT", label: "보유보고" },  // 변동없는 보고
];

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

const BADGE_CONFIG: Record<string, { label: string; cls: string }> = {
  BUY:          { label: "매수",   cls: "bg-pos/15 text-pos border-pos/25" },
  SELL:         { label: "매도",   cls: "bg-neg/15 text-neg border-neg/25" },
  RIGHTS_ISSUE: { label: "무상증자", cls: "bg-warn/15 text-warn border-warn/25" },
  PAID_IN:      { label: "유상증자", cls: "bg-info/15 text-info border-info/25" },
  CANCELLATION: { label: "주식소각", cls: "bg-accent/15 text-accent border-accent/25" },
  BUYBACK:      { label: "자사주매수", cls: "bg-pos/15 text-pos border-pos/25" },
  DISPOSAL:     { label: "자사주처분", cls: "bg-neg/15 text-neg border-neg/25" },
  HOLD_REPORT:  { label: "보유보고", cls: "bg-panel-2 text-text-3 border-border" },
  OTHER:        { label: "기타",   cls: "bg-panel-2 text-text-3 border-border" },
};

function Badge({ type }: { type: string }) {
  const cfg = BADGE_CONFIG[type] ?? BADGE_CONFIG.OTHER;
  return (
    <span className={`inline-block text-center text-[10px] font-bold rounded px-1.5 py-0.5 border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function isCorporateAction(type: string) {
  return ["RIGHTS_ISSUE", "PAID_IN", "CANCELLATION", "BUYBACK", "DISPOSAL"].includes(type);
}

// ── US Table ──────────────────────────────────────────────────────────────────

function USTable({ trades }: { trades: InsiderTrade[] }) {
  if (trades.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">거래 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
            <th className="px-3 py-2 text-left font-medium">날짜</th>
            <th className="px-3 py-2 text-left font-medium">티커</th>
            <th className="px-3 py-2 text-left font-medium">회사</th>
            <th className="px-3 py-2 text-left font-medium">내부자</th>
            <th className="px-3 py-2 text-center font-medium">구분</th>
            <th className="px-3 py-2 text-right font-medium">가격</th>
            <th className="px-3 py-2 text-right font-medium">주수</th>
            <th className="px-3 py-2 text-right font-medium">거래금액</th>
            <th className="px-3 py-2 text-right font-medium">보유후</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isBuy  = t.trade_type === "BUY";
            const isSell = t.trade_type === "SELL";
            const valClass = isBuy ? "bg-pos/20 text-pos" : isSell ? "bg-neg/20 text-neg" : "text-text-2";
            return (
              <tr
                key={i}
                className={`border-t border-border/50 transition-colors ${
                  isBuy ? "hover:bg-pos/5" : isSell ? "hover:bg-neg/5" : "hover:bg-panel-2"}`}
              >
                <td className="px-3 py-1.5 text-text-3 font-data whitespace-nowrap text-[11px]">
                  {t.trade_date}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="font-data font-bold text-accent text-sm">{t.ticker ?? "—"}</span>
                </td>
                <td className="px-3 py-1.5 text-text-2 max-w-[180px] truncate">{t.issuer ?? "—"}</td>
                <td className="px-3 py-1.5 text-text-1 max-w-[160px] truncate">{t.reporter}</td>
                <td className="px-3 py-1.5 text-center">
                  <Badge type={t.trade_type} />
                </td>
                <td className="px-3 py-1.5 text-right font-data text-text-2 whitespace-nowrap">
                  {t.price_per_share != null ? `$${t.price_per_share.toFixed(2)}` : "—"}
                </td>
                <td className={`px-3 py-1.5 text-right font-data font-bold whitespace-nowrap ${valClass}`}>
                  {fmtShares(t.shares)}
                </td>
                <td className={`px-3 py-1.5 text-right font-data font-bold whitespace-nowrap text-sm ${valClass}`}>
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

type LagState = { loading: boolean; lags?: number[]; error?: boolean };

function KRTable({ trades }: { trades: InsiderTrade[] }) {
  const [lagState, setLagState] = useState<Record<string, LagState>>({});
  const ctrlMapRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    const ctrlMap = ctrlMapRef.current;
    return () => { ctrlMap.forEach(c => c.abort()); };
  }, []);

  const fetchLag = useCallback((rceptNo: string, rceptDt: string) => {
    ctrlMapRef.current.get(rceptNo)?.abort();
    const ctrl = new AbortController();
    ctrlMapRef.current.set(rceptNo, ctrl);
    setLagState(s => ({ ...s, [rceptNo]: { loading: true } }));
    getInsiderKRReportLag(rceptNo, rceptDt, ctrl.signal)
      .then(res => {
        if (ctrlMapRef.current.get(rceptNo) !== ctrl) return;
        setLagState(s => ({ ...s, [rceptNo]: { loading: false, lags: res.lags_days } }));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (ctrlMapRef.current.get(rceptNo) !== ctrl) return;
        setLagState(s => ({ ...s, [rceptNo]: { loading: false, error: true } }));
      });
  }, []);

  if (trades.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">거래 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium">접수일</th>
            <th className="px-3 py-2 text-left font-medium">종목</th>
            <th className="px-3 py-2 text-left font-medium">회사명</th>
            <th className="px-3 py-2 text-center font-medium">구분</th>
            <th className="px-3 py-2 text-left font-medium">공시명</th>
            <th className="px-3 py-2 text-center font-medium">지연</th>
            <th className="px-3 py-2 text-center font-medium">원문</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isBuy = t.trade_type === "BUY";
            const isSell = t.trade_type === "SELL";
            const isCorpAction = isCorporateAction(t.trade_type);
            const rowHover = isBuy ? "hover:bg-pos/5": isSell ? "hover:bg-neg/5": isCorpAction ? "hover:bg-warn/5": "hover:bg-panel-2";
            const rceptNo = t.rcept_no;
            const lag = rceptNo ? lagState[rceptNo] : undefined;
            return (
              <tr key={i} className={`border-t border-border transition-colors ${rowHover}`}>
                <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">{t.trade_date}</td>
                <td className="px-3 py-2 font-data font-semibold text-accent whitespace-nowrap">
                  {t.ticker ?? "—"}
                </td>
                <td className="px-3 py-2 text-text-2 max-w-[160px] truncate">{t.corp_name ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <Badge type={t.trade_type} />
                </td>
                <td className="px-3 py-2 text-text-2 text-[11px] max-w-[280px] truncate">
                  {t.report_type || t.event_cause || "—"}
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {!rceptNo ? "—" : lag?.loading ? (
                    <span className="text-text-3 text-[10px]">조회중…</span>
                  ) : lag?.error ? (
                    <span className="text-neg text-[10px]">실패</span>
                  ) : lag?.lags ? (
                    lag.lags.length === 0 ? (
                      <span className="text-text-3 text-[10px]">—</span>
                    ) : (
                      <span className={`text-[10px] font-data font-semibold ${Math.max(...lag.lags) > 5 ? "text-warn" : "text-text-2"}`}>
                        {lag.lags.join(",")}일
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => fetchLag(rceptNo, t.trade_date)}
                      className="text-[10px] text-accent hover:underline"
                    >
                      확인
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {t.dart_url ? (
                    <a href={t.dart_url} target="_blank" rel="noopener noreferrer"className="text-[10px] text-accent hover:underline whitespace-nowrap">공시↗</a>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Congress Table ──────────────────────────────────────────────────────────

function CongressTable({ trades }: { trades: import("@/lib/api").CongressTrade[] }) {
  if (trades.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">거래 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium">신고일</th>
            <th className="px-3 py-2 text-left font-medium">거래일</th>
            <th className="px-3 py-2 text-left font-medium">의원</th>
            <th className="px-3 py-2 text-left font-medium">원</th>
            <th className="px-3 py-2 text-left font-medium">티커</th>
            <th className="px-3 py-2 text-center font-medium">구분</th>
            <th className="px-3 py-2 text-right font-medium">금액</th>
            <th className="px-3 py-2 text-center font-medium">원문</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isBuy = t.trade_type === "BUY";
            return (
              <tr key={i} className={`border-t border-border transition-colors ${isBuy ? "hover:bg-pos/5" : "hover:bg-neg/5"}`}>
                <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">{t.disclosure_date}</td>
                <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">{t.trade_date}</td>
                <td className="px-3 py-2 text-text-1 max-w-[160px] truncate">
                  {t.reporter}{t.owner && t.owner !== "Self" && <span className="text-text-3 text-[10px]"> ({t.owner})</span>}
                </td>
                <td className="px-3 py-2 text-text-3 text-[10px]">{t.chamber === "senate" ? "상원" : "하원"} {t.district}</td>
                <td className="px-3 py-2 font-data font-semibold text-accent whitespace-nowrap">{t.ticker ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 border ${isBuy ? "bg-pos/15 text-pos border-pos/25" : "bg-neg/15 text-neg border-neg/25"}`}>
                    {isBuy ? "매수" : "매도"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-data text-text-2 whitespace-nowrap text-[11px]">{t.amount}</td>
                <td className="px-3 py-2 text-center">
                  {t.link ? <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline">공시↗</a> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Gov Contracts Table ───────────────────────────────────────────────────────

function GovTable({ rows }: { rows: import("@/lib/api").GovContract[] }) {
  if (rows.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">계약 없음</div>;
  const fmtB = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium">시작일</th>
            <th className="px-3 py-2 text-left font-medium">수주 기업</th>
            <th className="px-3 py-2 text-left font-medium">발주 기관</th>
            <th className="px-3 py-2 text-left font-medium">내용</th>
            <th className="px-3 py-2 text-right font-medium">계약금액</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
              <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">{x.start_date || "—"}</td>
              <td className="px-3 py-2 text-text-1 max-w-[200px] truncate font-medium">{x.recipient}</td>
              <td className="px-3 py-2 text-text-3 max-w-[160px] truncate">{x.agency}</td>
              <td className="px-3 py-2 text-text-3 text-[11px] max-w-[240px] truncate">{x.description || "—"}</td>
              <td className="px-3 py-2 text-right font-data font-semibold text-pos whitespace-nowrap">{fmtB(x.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Options UOA Table ─────────────────────────────────────────────────────────

function OptionsUOATable({ rows }: { rows: import("@/lib/api").OptionsUOA[] }) {
  if (rows.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">플래그된 콘트랙트 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium">티커</th>
            <th className="px-3 py-2 text-left font-medium">콘트랙트</th>
            <th className="px-3 py-2 text-right font-medium">만기(D)</th>
            <th className="px-3 py-2 text-right font-medium">OTM</th>
            <th className="px-3 py-2 text-right font-medium">거래량</th>
            <th className="px-3 py-2 text-right font-medium">OI</th>
            <th className="px-3 py-2 text-right font-medium">Vol/OI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
              <td className="px-3 py-2 text-text-1 font-medium font-data">{x.ticker}</td>
              <td className="px-3 py-2 text-text-3 font-data whitespace-nowrap">
                <span className={x.type === "call" ? "text-pos" : "text-neg"}>{x.type === "call" ? "C" : "P"}</span>
                {" "}${x.strike} · {x.expiration_date}
              </td>
              <td className="px-3 py-2 text-right font-data text-text-3">{x.dte}</td>
              <td className="px-3 py-2 text-right font-data text-text-3">{x.moneyness_pct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-right font-data text-text-1">{x.volume.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-data text-text-3">{x.open_interest.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-data font-semibold text-warn">{x.vol_oi_ratio.toFixed(1)}x</td>
            </tr>
          ))}
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
          <span className={`ml-2 font-data font-medium px-1 font-bold ${buyVal - sellVal >= 0 ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
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
        placeholder="회사명 검색…"className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-xs w-44 focus:border-accent outline-none"/>
      <Button
        variant="primary"
        size="sm"
        onClick={search}
        disabled={loading}
        className="rounded hover:opacity-90">
        {loading ? "…" : "검색"}
      </Button>
      {results.length > 0 && (
        <div className="absolute top-8 left-0 z-20 bg-panel border border-border rounded-lg shadow-xl min-w-[220px] overflow-hidden">
          {results.slice(0, 8).map(c => (
            <button
              key={c.corp_code}
              onClick={() => { onSelect(c); setResults([]); setQ(""); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-panel-2 text-left border-t border-border first:border-0">
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
  const [days] = useState(30);
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

  // Congress state
  const [congData, setCongData] = useState<CongressTrade[]>([]);
  const [congLoading, setCongLoading] = useState(false);
  const [congError, setCongError] = useState<string | null>(null);

  // Gov contracts state
  const [govData, setGovData] = useState<GovContract[]>([]);
  const [govLoading, setGovLoading] = useState(false);
  const [govError, setGovError] = useState<string | null>(null);
  const govCtrl = useRef<AbortController | null>(null);

  // Options UOA state
  const [uoaTicker, setUoaTicker] = useState("");
  const [uoaData, setUoaData] = useState<OptionsUOA[]>([]);
  const [uoaLoading, setUoaLoading] = useState(false);
  const [uoaError, setUoaError] = useState<string | null>(null);
  const uoaCtrl = useRef<AbortController | null>(null);

  const fetchUOA = useCallback(async (tickers?: string) => {
    uoaCtrl.current?.abort();
    const ctrl = new AbortController();
    uoaCtrl.current = ctrl;
    setUoaLoading(true); setUoaError(null); setUoaData([]);
    try {
      const res = await getOptionsUOA(tickers, ctrl.signal);
      if (!ctrl.signal.aborted) setUoaData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted) setUoaError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setUoaLoading(false);
    }
  }, []);

  const fetchGov = useCallback(async () => {
    govCtrl.current?.abort();
    const ctrl = new AbortController();
    govCtrl.current = ctrl;
    setGovLoading(true); setGovError(null); setGovData([]);
    try {
      const res = await getGovContracts(30, 40, ctrl.signal);
      if (!ctrl.signal.aborted) setGovData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted) setGovError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setGovLoading(false);
    }
  }, []);

  const usCtrl = useRef<AbortController | null>(null);
  const krCtrl = useRef<AbortController | null>(null);
  const congCtrl = useRef<AbortController | null>(null);

  useEffect(() => () => { usCtrl.current?.abort(); krCtrl.current?.abort(); congCtrl.current?.abort(); govCtrl.current?.abort(); uoaCtrl.current?.abort(); }, []);

  const fetchCongress = useCallback(async () => {
    congCtrl.current?.abort();
    const ctrl = new AbortController();
    congCtrl.current = ctrl;
    setCongLoading(true); setCongError(null); setCongData([]);
    try {
      const res = await getInsiderCongress(80, ctrl.signal);
      if (!ctrl.signal.aborted) setCongData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted) setCongError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setCongLoading(false);
    }
  }, []);

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

  const fetchUSRecent = useCallback(async (d: number) => {
    usCtrl.current?.abort();
    const ctrl = new AbortController();
    usCtrl.current = ctrl;
    setUsLoading(true); setUsError(null); setUsData([]);
    try {
      const res = await getInsiderUSRecent(d, 30, ctrl.signal);
      if (!ctrl.signal.aborted) setUsData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted) setUsError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setUsLoading(false);
    }
  }, []);

  const fetchKRRecent = useCallback(async (d: number) => {
    krCtrl.current?.abort();
    const ctrl = new AbortController();
    krCtrl.current = ctrl;
    setKrLoading(true); setKrError(null); setKrData([]);
    try {
      const res = await getInsiderKRRecent(d, 20, ctrl.signal);
      if (!ctrl.signal.aborted) setKrData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted) setKrError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setKrLoading(false);
    }
  }, []);

  // Auto-load recent data when market or days changes
  useEffect(() => {
    if (market === "us") fetchUSRecent(days);
    else if (market === "kr") fetchKRRecent(days);
    else if (market === "congress") fetchCongress();
    else if (market === "gov") fetchGov();
    else fetchUOA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, days]);

  // Filter logic
  const rawData = market === "us" ? usData : krData;
  const filtered = rawData.filter(t => {
    if (tradeFilter !== "all") {
      if (tradeFilter === "CORP_ACTION") {
        if (!isCorporateAction(t.trade_type)) return false;
      } else if (tradeFilter === "HOLD_REPORT") {
        if (t.trade_type !== "HOLD_REPORT") return false;
      } else {
        if (t.trade_type !== tradeFilter) return false;
      }
    }
    if (market === "us" && minValue > 0 && (t.value_usd ?? 0) < minValue) return false;
    if (tickerSearch) {
      const needle = tickerSearch.toUpperCase();
      const haystack = (market === "us"? `${t.ticker ?? ""} ${t.issuer ?? ""}`
        : `${t.ticker ?? ""} ${t.corp_name ?? ""}`
      ).toUpperCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="p-4 space-y-4 max-w-full">
      <div className="mb-4">
        <h1 className="text-text-1 text-lg font-semibold tracking-tight">내부자 거래 모니터</h1>
        <p className="text-text-3 text-sm mt-0.5">미국(SEC EDGAR Form 4)과 한국(OpenDART) 임원·주요주주의 공개시장 매수/매도 내역을 조회합니다. 내부자 거래는 합법적이며, 공시 의무가 있는 정보입니다.</p>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center bg-panel border border-border rounded-lg px-4 py-3">

        {/* Market tabs */}
        <div className="mr-2">
          <SegmentedToggle
            value={market}
            onChange={setMarket}
            size="sm"
            options={[
              { value: "us", label: "🇺🇸 US", activeClass: "border-accent bg-accent text-black" },
              { value: "kr", label: "🇰🇷 KR", activeClass: "border-accent bg-accent text-black" },
              { value: "congress", label: " 의회", activeClass: "border-accent bg-accent text-black" },
              { value: "gov", label: " 정부계약", activeClass: "border-accent bg-accent text-black" },
              { value: "options", label: "🎯 옵션 UOA", activeClass: "border-accent bg-accent text-black" },
            ]}
          />
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Trade type */}
        <SegmentedToggle
          value={tradeFilter}
          onChange={setTradeFilter}
          size="sm"
          options={(market === "kr" ? KR_TRADE_FILTER_OPTS : [
            { value: "all" as TradeFilter, label: "전체" },
            { value: "BUY" as TradeFilter, label: "매수" },
            { value: "SELL" as TradeFilter, label: "매도" },
          ]).map(f => ({
            ...f,
            activeClass:
              f.value === "BUY" ? "border-pos text-pos bg-pos/10"
              : f.value === "SELL" ? "border-neg text-neg bg-neg/10"
              : f.value === "CORP_ACTION" ? "border-warn text-warn bg-warn/10"
              : "border-accent text-accent bg-accent/10",
          }))}
        />

        {/* Min value (US only) */}
        {market === "us" && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-text-3 text-xs">최소금액:</span>
              <select
                value={minValue}
                onChange={e => setMinValue(Number(e.target.value) as MinValue)}
                className="bg-bg border border-border rounded px-2 py-0.5 text-text-1 text-xs">
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
          placeholder={market === "us" ? "티커 / 회사명 필터…" : "종목코드 / 회사명 필터…"}
          className="bg-bg border border-border rounded px-2 py-1 text-text-1 text-xs w-44 focus:border-accent outline-none"/>
      </div>

      {/* ── Search row (US/KR only) ─────────────────────────────────────── */}
      {(market === "us" || market === "kr") && (
      <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3">
        {market === "us" ? (
          <>
            <span className="text-text-3 text-xs shrink-0">티커 검색:</span>
            <input
              value={usTicker}
              onChange={e => setUsTicker(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter" && usTicker) fetchUS(usTicker, days); }}
              placeholder="AAPL…  (비워두면 전체 최근 내역)"className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-sm font-data w-52 focus:border-accent outline-none"/>
            {usTicker && (
              <Button
                variant="primary"
                size="md"
                onClick={() => fetchUS(usTicker, days)}
                disabled={usLoading}
                className="rounded hover:opacity-90">
                {usLoading ? "…" : "조회"}
              </Button>
            )}
            {usTicker && (
              <button
                onClick={() => { setUsTicker(""); fetchUSRecent(days); }}
                className="text-text-3 text-xs hover:text-text-1 border border-border rounded px-2 py-1.5">
                전체보기
              </button>
            )}
            <span className="text-text-3 text-xs ml-auto">SEC EDGAR Form 4</span>
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
      )}

      {/* ── Search row (Options UOA) ────────────────────────────────────── */}
      {market === "options" && (
        <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3">
          <span className="text-text-3 text-xs shrink-0">티커 (선택, 쉼표구분):</span>
          <input
            value={uoaTicker}
            onChange={e => setUoaTicker(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") fetchUOA(uoaTicker || undefined); }}
            placeholder="MSTR, TSLA…  (비워두면 다른 insider leg 플래그 티커 자동조회)"
            className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-sm font-data w-96 focus:border-accent outline-none"/>
          <Button
            variant="primary"
            size="md"
            onClick={() => fetchUOA(uoaTicker || undefined)}
            disabled={uoaLoading}
            className="rounded hover:opacity-90">
            {uoaLoading ? "…" : "조회"}
          </Button>
          {uoaTicker && (
            <button
              onClick={() => { setUoaTicker(""); fetchUOA(); }}
              className="text-text-3 text-xs hover:text-text-1 border border-border rounded px-2 py-1.5">
              자동조회로
            </button>
          )}
          <span className="text-text-3 text-xs ml-auto">Alpaca 옵션체인 · 만기짧고+OTM깊고+Vol/OI급등</span>
        </div>
      )}

      {/* ── Congress ────────────────────────────────────────────────────── */}
      {market === "congress" && (
        <>
          {congError && <p className="text-neg text-sm px-1">{congError}</p>}
          {congLoading && <p className="text-text-3 text-sm px-1">로딩 중…</p>}
          {!congLoading && (
            <Panel>
              <CongressTable trades={congData} />
            </Panel>
          )}
        </>
      )}

      {/* ── Gov contracts ───────────────────────────────────────────────── */}
      {market === "gov" && (
        <>
          {govError && <p className="text-neg text-sm px-1">{govError}</p>}
          {govLoading && <p className="text-text-3 text-sm px-1">로딩 중… (USASpending)</p>}
          {!govLoading && (
            <Panel>
              <GovTable rows={govData} />
            </Panel>
          )}
        </>
      )}

      {/* ── Options UOA ─────────────────────────────────────────────────── */}
      {market === "options" && (
        <>
          {uoaError && <p className="text-neg text-sm px-1">{uoaError}</p>}
          {uoaLoading && <p className="text-text-3 text-sm px-1">로딩 중… (옵션체인 스캔)</p>}
          {!uoaLoading && (
            <Panel>
              <OptionsUOATable rows={uoaData} />
            </Panel>
          )}
        </>
      )}

      {/* ── US/KR Error ─────────────────────────────────────────────────── */}
      {market === "us" && usError && <p className="text-neg text-sm px-1">{usError}</p>}
      {market === "kr" && krError && <p className="text-neg text-sm px-1">{krError}</p>}

      {/* ── Loading hint ────────────────────────────────────────────────── */}
      {market === "us" && usLoading && (
        <p className="text-text-3 text-sm px-1">로딩 중… (EDGAR 응답 5~20초 소요)</p>
      )}
      {market === "kr" && krLoading && (
        <p className="text-text-3 text-sm px-1">로딩 중…</p>
      )}

      {/* ── US/KR Results ───────────────────────────────────────────────── */}
      {(market === "us" || market === "kr") && (filtered.length > 0 || rawData.length > 0) ? (
        <Panel>
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
        </Panel>
      ) : (
        (market === "us" || market === "kr") && !usLoading && !krLoading && (rawData.length === 0) && (
          <Panel className="p-12 text-center">
            <p className="text-text-3 text-sm">데이터 없음</p>
          </Panel>
        )
      )}
    </div>
  );
}
