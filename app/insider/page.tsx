"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  getInsiderConvergence,
  searchDartCompany,
  type DartCompany,
  type InsiderTrade,
  type InsiderTradeType,
  type CongressTrade,
  type GovContract,
  type OptionsUOA,
  type ConvergenceSignal,
} from "@/lib/api";
import { Panel } from "@/components/ui/Panel";
import { Button, SegmentedToggle, LoadingState } from "@/components/ui";

type Market = "us" | "kr" | "congress" | "gov" | "options" | "convergence" | "overall";
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

type SortKey = "date" | "value";

function SortHeader({ label, active, dir, onClick, align = "left" }: {
  label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void; align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-text-1 ${align === "right" ? "text-right" : "text-left"}`}
      onClick={onClick}
    >
      {label}{active && <span className="text-accent ml-0.5">{dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );
}

function USTable({ trades }: { trades: InsiderTrade[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  const sorted = [...trades].sort((a, b) => {
    const av = sort.key === "date" ? a.trade_date : (a.value_usd ?? 0);
    const bv = sort.key === "date" ? b.trade_date : (b.value_usd ?? 0);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sort.dir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  }

  if (trades.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">거래 없음</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
            <SortHeader label="날짜" active={sort.key === "date"} dir={sort.dir} onClick={() => toggleSort("date")} />
            <th className="px-3 py-2 text-left font-medium">티커</th>
            <th className="px-3 py-2 text-left font-medium">회사</th>
            <th className="px-3 py-2 text-left font-medium">내부자</th>
            <th className="px-3 py-2 text-center font-medium">구분</th>
            <th className="px-3 py-2 text-right font-medium">가격</th>
            <th className="px-3 py-2 text-right font-medium">주수</th>
            <SortHeader label="거래금액" active={sort.key === "value"} dir={sort.dir} onClick={() => toggleSort("value")} align="right" />
            <th className="px-3 py-2 text-right font-medium">보유후</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => {
            const isBuy  = t.trade_type === "BUY";
            const isSell = t.trade_type === "SELL";
            const valClass = isBuy ? "bg-pos/20 text-pos" : isSell ? "bg-neg/20 text-neg" : "text-text-2";
            return (
              <tr
                key={i}
                className={`border-t border-border/50 transition-colors ${
                  isBuy ? "bg-pos/5 hover:bg-pos/10" : isSell ? "bg-neg/5 hover:bg-neg/10" : "hover:bg-panel-2"}`}
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
            const tint = isBuy ? "bg-pos/5 hover:bg-pos/10"
              : isSell ? "bg-neg/5 hover:bg-neg/10"
              : isCorpAction ? "bg-warn/5 hover:bg-warn/10"
              : "hover:bg-panel-2";
            const rceptNo = t.rcept_no;
            const lag = rceptNo ? lagState[rceptNo] : undefined;
            return (
              <tr key={i} className={`border-t border-border transition-colors ${tint}`}>
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

// ── Signal Grid (scored, bot-condition-friendly) ───────────────────────────────
// score: -1..1 (양수=매수/콜/상승 쏠림, 음수=매도/풋 쏠림). gov는 0..1(단방향, 계약 자체가 항상 호재).

type Signal = { key: string; score: number; detail: string };

// 막대 폭: style={{}} 금지 → 리터럴 폭 클래스(5% 스텝)
const WIDTHS: Record<number, string> = {
  0: "w-0", 5: "w-[5%]", 10: "w-[10%]", 15: "w-[15%]", 20: "w-[20%]", 25: "w-[25%]", 30: "w-[30%]",
  35: "w-[35%]", 40: "w-[40%]", 45: "w-[45%]", 50: "w-[50%]", 55: "w-[55%]", 60: "w-[60%]", 65: "w-[65%]",
  70: "w-[70%]", 75: "w-[75%]", 80: "w-[80%]", 85: "w-[85%]", 90: "w-[90%]", 95: "w-[95%]", 100: "w-full",
};
function widthClass(p: number): string { return WIDTHS[Math.max(0, Math.min(100, Math.round(p / 5) * 5))] ?? "w-0"; }

function SignalGrid({ note, signals }: { note: string; signals: Signal[] }) {
  if (signals.length === 0) return null;
  return (
    <Panel className="p-3">
      <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2 px-1">{note}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {signals.map(s => {
          const isPos = s.score >= 0;
          const pct = Math.round(Math.abs(s.score) * 100);
          return (
            <div key={s.key} className={`rounded-lg border p-2.5 ${isPos ? "border-pos/25 bg-pos/5" : "border-neg/25 bg-neg/5"}`}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="font-data font-bold text-text-1 text-sm truncate">{s.key}</span>
                <span className={`font-data text-xs font-bold whitespace-nowrap ${isPos ? "text-pos" : "text-neg"}`}>
                  {isPos ? "+" : ""}{s.score.toFixed(2)}
                </span>
              </div>
              <div className="h-1 w-full rounded-full overflow-hidden bg-neg/20 flex mb-1">
                <div className={`h-full ${isPos ? "bg-pos" : "bg-neg ml-auto"} ${widthClass(pct)}`} />
              </div>
              <div className="text-text-3 text-[10px]">{s.detail}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function computeOptionSignals(rows: import("@/lib/api").OptionsUOA[]): Signal[] {
  const byTicker = new Map<string, { callN: number; putN: number; callVol: number; putVol: number }>();
  for (const x of rows) {
    const agg = byTicker.get(x.ticker) ?? { callN: 0, putN: 0, callVol: 0, putVol: 0 };
    if (x.type === "call") { agg.callN += 1; agg.callVol += x.volume; }
    else { agg.putN += 1; agg.putVol += x.volume; }
    byTicker.set(x.ticker, agg);
  }
  const signals: Signal[] = [];
  for (const [ticker, agg] of byTicker) {
    if (agg.callN + agg.putN < 2) continue; // 노이즈: 계약 1건은 신뢰 낮음
    const totalVol = agg.callVol + agg.putVol;
    if (totalVol === 0) continue;
    const score = (agg.callVol - agg.putVol) / totalVol;
    if (score === 0) continue;
    signals.push({
      key: ticker,
      score,
      detail: `콜 ${agg.callN}건 (거래량 ${agg.callVol.toLocaleString()}) · 풋 ${agg.putN}건 (거래량 ${agg.putVol.toLocaleString()})`,
    });
  }
  return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 12);
}

// DART 기업행위 방향성 — insider/convergence.py _DART_CORP_ACTION_DIRECTION과 동일 매핑(+CANCELLATION은 소각이라 출처 무관 호재).
const KR_CORP_ACTION_DIRECTION: Partial<Record<InsiderTradeType, "BUY" | "SELL">> = {
  BUYBACK: "BUY", CANCELLATION: "BUY", PAID_IN: "SELL", DISPOSAL: "SELL",
};

function computeTickerSignals(trades: InsiderTrade[], market: Market): Signal[] {
  const byTicker = new Map<string, { buyN: number; sellN: number; buyW: number; sellW: number }>();
  for (const t of trades) {
    const dir = t.trade_type === "BUY" || t.trade_type === "SELL" ? t.trade_type : KR_CORP_ACTION_DIRECTION[t.trade_type];
    if (!dir) continue;
    const ticker = t.ticker || t.issuer || t.corp_name;
    if (!ticker) continue;
    const weight = market === "us" ? (t.value_usd ?? 0) : 1;
    const agg = byTicker.get(ticker) ?? { buyN: 0, sellN: 0, buyW: 0, sellW: 0 };
    if (dir === "BUY") { agg.buyN += 1; agg.buyW += weight; }
    else { agg.sellN += 1; agg.sellW += weight; }
    byTicker.set(ticker, agg);
  }

  const signals: Signal[] = [];
  for (const [ticker, agg] of byTicker) {
    const totalW = agg.buyW + agg.sellW;
    const totalN = agg.buyN + agg.sellN;
    if (totalN < 2) continue; // 노이즈: 표본 1건은 신뢰 낮음
    const score = totalW > 0 ? (agg.buyW - agg.sellW) / totalW : (agg.buyN - agg.sellN) / totalN;
    if (score === 0) continue; // 완전 동률은 방향 판단 불가
    signals.push({
      key: ticker,
      score,
      detail: `매수 ${agg.buyN}건${market === "us" && agg.buyW > 0 ? ` (${fmt$(agg.buyW)})` : ""} · 매도 ${agg.sellN}건${market === "us" && agg.sellW > 0 ? ` (${fmt$(agg.sellW)})` : ""}`,
    });
  }
  return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 12);
}

function parseAmountMidpoint(s?: string | null): number {
  if (!s) return 0;
  const nums = Array.from(s.matchAll(/[\d,]+/g))
    .map(m => Number(m[0].replace(/,/g, "")))
    .filter(n => !Number.isNaN(n) && n > 0);
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

function computeCongressSignals(trades: import("@/lib/api").CongressTrade[]): Signal[] {
  const byTicker = new Map<string, { buyN: number; sellN: number; buyW: number; sellW: number }>();
  for (const t of trades) {
    if (t.trade_type !== "BUY" && t.trade_type !== "SELL") continue;
    if (!t.ticker) continue;
    const weight = parseAmountMidpoint(t.amount);
    const agg = byTicker.get(t.ticker) ?? { buyN: 0, sellN: 0, buyW: 0, sellW: 0 };
    if (t.trade_type === "BUY") { agg.buyN += 1; agg.buyW += weight; }
    else { agg.sellN += 1; agg.sellW += weight; }
    byTicker.set(t.ticker, agg);
  }

  const signals: Signal[] = [];
  for (const [ticker, agg] of byTicker) {
    const totalW = agg.buyW + agg.sellW;
    const totalN = agg.buyN + agg.sellN;
    if (totalN < 2) continue; // 노이즈: 표본 1건은 신뢰 낮음
    const score = totalW > 0 ? (agg.buyW - agg.sellW) / totalW : (agg.buyN - agg.sellN) / totalN;
    if (score === 0) continue;
    signals.push({
      key: ticker,
      score,
      detail: `매수 ${agg.buyN}건${agg.buyW > 0 ? ` (${fmt$(agg.buyW)})` : ""} · 매도 ${agg.sellN}건${agg.sellW > 0 ? ` (${fmt$(agg.sellW)})` : ""}`,
    });
  }
  return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 12);
}

// gov contract: 항상 호재(수주=매수 방향 뉴스)라 방향 대칭이 없음 — score는 0..1, 현재 로드된 목록 내 최대 수주기업 대비 상대 규모.
function computeGovSignals(rows: import("@/lib/api").GovContract[]): Signal[] {
  const byRecipient = new Map<string, { amount: number; n: number }>();
  for (const r of rows) {
    const agg = byRecipient.get(r.recipient) ?? { amount: 0, n: 0 };
    agg.amount += r.amount;
    agg.n += 1;
    byRecipient.set(r.recipient, agg);
  }
  const maxAmount = Math.max(0, ...Array.from(byRecipient.values(), a => a.amount));
  if (maxAmount === 0) return [];

  const signals: Signal[] = [];
  for (const [recipient, agg] of byRecipient) {
    signals.push({
      key: recipient,
      score: agg.amount / maxAmount,
      detail: `계약 ${agg.n}건 · 합계 ${fmt$(agg.amount)}`,
    });
  }
  return signals.sort((a, b) => b.score - a.score).slice(0, 12);
}

// ── 종합 신호 (소스 교차 티커 합산) ──────────────────────────────────────────────
// 정부계약은 ticker 필드가 없어(recipient=회사명) 여기 합치지 못함 — 정부계약 탭에서 별도 확인.

type OverallRow = { ticker: string; us?: number; kr?: number; congress?: number; options?: number; composite: number; n: number };

function computeOverallSignals(us: Signal[], kr: Signal[], congress: Signal[], options: Signal[]): OverallRow[] {
  const map = new Map<string, { us?: number; kr?: number; congress?: number; options?: number }>();
  const add = (list: Signal[], field: "us" | "kr" | "congress" | "options") => {
    for (const s of list) {
      const e = map.get(s.key) ?? {};
      e[field] = s.score;
      map.set(s.key, e);
    }
  };
  add(us, "us"); add(kr, "kr"); add(congress, "congress"); add(options, "options");

  const rows: OverallRow[] = [];
  for (const [ticker, e] of map) {
    const scores = [e.us, e.kr, e.congress, e.options].filter((v): v is number => v !== undefined);
    if (scores.length === 0) continue;
    const composite = scores.reduce((a, b) => a + b, 0) / scores.length;
    rows.push({ ticker, ...e, composite, n: scores.length });
  }
  return rows.sort((a, b) => b.n - a.n || Math.abs(b.composite) - Math.abs(a.composite));
}

function OverallTable({ rows }: { rows: OverallRow[] }) {
  if (rows.length === 0)
    return <div className="p-8 text-center text-text-3 text-sm">신호 없음</div>;
  const cell = (v?: number) => v === undefined
    ? <span className="text-text-3">—</span>
    : <span className={`font-data font-semibold ${v >= 0 ? "text-pos" : "text-neg"}`}>{v >= 0 ? "+" : ""}{v.toFixed(2)}</span>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider">
            <th className="px-3 py-2 text-left font-medium">티커</th>
            <th className="px-3 py-2 text-right font-medium">내부자(US)</th>
            <th className="px-3 py-2 text-right font-medium">내부자(KR)</th>
            <th className="px-3 py-2 text-right font-medium">의회</th>
            <th className="px-3 py-2 text-right font-medium">옵션</th>
            <th className="px-3 py-2 text-right font-medium">종합</th>
            <th className="px-3 py-2 text-center font-medium">소스수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ticker} className={`border-t transition-colors ${r.n >= 2 ? "border-l-2 border-l-accent bg-accent/5" : ""} border-border ${r.composite >= 0 ? "hover:bg-pos/5" : "hover:bg-neg/5"}`}>
              <td className="px-3 py-2 font-data font-semibold text-text-1 whitespace-nowrap">{r.ticker}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{cell(r.us)}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{cell(r.kr)}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{cell(r.congress)}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{cell(r.options)}</td>
              <td className={`px-3 py-2 text-right font-data font-bold whitespace-nowrap ${r.composite >= 0 ? "text-pos" : "text-neg"}`}>
                {r.composite >= 0 ? "+" : ""}{r.composite.toFixed(2)}
              </td>
              <td className={`px-3 py-2 text-center ${r.n >= 2 ? "text-accent font-bold" : "text-text-3"}`}>{r.n}</td>
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
  const ratioBase = market === "us" ? buyVal + sellVal : buys.length + sells.length;
  const buyShare = ratioBase > 0
    ? (market === "us" ? buyVal : buys.length) / ratioBase * 100
    : 50;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-panel-2 border-b border-border text-xs">
    {ratioBase > 0 && (
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-neg/20 flex">
        <div className={`h-full bg-pos ${widthClass(buyShare)}`} />
      </div>
    )}
    <div className="flex flex-wrap gap-6">
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

function InsiderPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [market, setMarketState] = useState<Market>(
    (searchParams.get("tab") as Market) === "convergence" ? "convergence" : "us"
  );
  const setMarket = useCallback((m: Market) => {
    setMarketState(m);
    router.replace(m === "convergence" ? "/insider?tab=convergence" : "/insider", { scroll: false });
  }, [router]);
  useEffect(() => {
    if (searchParams.get("tab") === "convergence") setMarketState("convergence");
  }, [searchParams]);
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

  // Convergence state
  const [convMarket, setConvMarket] = useState<"kr" | "us">("kr");
  const [convData, setConvData] = useState<ConvergenceSignal[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [convDrawer, setConvDrawer] = useState<ConvergenceSignal | null>(null);
  const [convOptionScores, setConvOptionScores] = useState<Record<string, number>>({});
  const convCtrl = useRef<AbortController | null>(null);
  const convUoaCtrl = useRef<AbortController | null>(null);
  const convMountedRef = useRef(false);

  const fetchConvergence = useCallback(async (m: "kr" | "us") => {
    convCtrl.current?.abort();
    const ctrl = new AbortController();
    convCtrl.current = ctrl;
    setConvLoading(true); setConvError(null); setConvData([]);
    try {
      const res = await getInsiderConvergence(m, 30, ctrl.signal);
      if (!ctrl.signal.aborted) setConvData(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted) setConvError(e instanceof ApiError ? e.message : "조회 실패");
    } finally {
      if (!ctrl.signal.aborted) setConvLoading(false);
    }
  }, []);

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

  useEffect(() => () => { usCtrl.current?.abort(); krCtrl.current?.abort(); congCtrl.current?.abort(); govCtrl.current?.abort(); uoaCtrl.current?.abort(); convCtrl.current?.abort(); convUoaCtrl.current?.abort(); }, []);

  // 컨버전스 카드에 옵션 leg의 콜/풋 쏠림 score를 얹기 위해, options_uoa leg가 있는 티커만 추가 조회
  useEffect(() => {
    const tickers = Array.from(new Set(
      convData.filter(s => s.market === "us" && s.legs.some(l => l.source === "options_uoa")).map(s => s.ticker)
    ));
    convUoaCtrl.current?.abort();
    if (tickers.length === 0) { setConvOptionScores({}); return; }
    const ctrl = new AbortController();
    convUoaCtrl.current = ctrl;
    (async () => {
      try {
        const rows = await getOptionsUOA(tickers.join(","), ctrl.signal);
        if (ctrl.signal.aborted) return;
        const scores: Record<string, number> = {};
        for (const s of computeOptionSignals(rows)) scores[s.key] = s.score;
        setConvOptionScores(scores);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    })();
  }, [convData]);

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
    else if (market === "convergence") fetchConvergence(convMarket);
    else if (market === "overall") { fetchUSRecent(days); fetchKRRecent(days); fetchCongress(); fetchUOA(); }
    else fetchUOA();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, days]);

  useEffect(() => {
    if (!convMountedRef.current) {
      convMountedRef.current = true;
      return;
    }
    if (market === "convergence") fetchConvergence(convMarket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convMarket]);

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
              { value: "overall", label: "종합", activeClass: "border-accent bg-accent text-black" },
              { value: "us", label: "US", activeClass: "border-accent bg-accent text-black" },
              { value: "kr", label: "KR", activeClass: "border-accent bg-accent text-black" },
              { value: "congress", label: "의회", activeClass: "border-accent bg-accent text-black" },
              { value: "gov", label: "정부계약", activeClass: "border-accent bg-accent text-black" },
              { value: "options", label: "옵션 UOA", activeClass: "border-accent bg-accent text-black" },
              { value: "convergence", label: "컨버전스", activeClass: "border-accent bg-accent text-black" },
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

      {/* ── Overall ─────────────────────────────────────────────────────── */}
      {market === "overall" && (
        <>
          {(usLoading || krLoading || congLoading || uoaLoading) && <p className="text-text-3 text-sm px-1">로딩 중…</p>}
          <Panel className="p-3">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2 px-1">
              소스별 -1~+1 score · 종합은 존재하는 소스 평균(정렬용, 절대 신뢰값 아님) · 정부계약은 티커 연결 안 돼 제외(정부계약 탭 별도 확인)
            </div>
            <OverallTable rows={computeOverallSignals(
              computeTickerSignals(usData, "us"),
              computeTickerSignals(krData, "kr"),
              computeCongressSignals(congData),
              computeOptionSignals(uoaData)
            )} />
          </Panel>
        </>
      )}

      {/* ── Congress ────────────────────────────────────────────────────── */}
      {market === "congress" && (
        <>
          {congError && <p className="text-neg text-sm px-1">{congError}</p>}
          {congLoading && <p className="text-text-3 text-sm px-1">로딩 중…</p>}
          {!congLoading && (
            <>
              <SignalGrid note="종목별 의회 매매 신호 — score -1~+1, 신고금액 구간 중간값 가중 매수/매도 쏠림" signals={computeCongressSignals(congData)} />
              <Panel>
                <CongressTable trades={congData} />
              </Panel>
            </>
          )}
        </>
      )}

      {/* ── Gov contracts ───────────────────────────────────────────────── */}
      {market === "gov" && (
        <>
          {govError && <p className="text-neg text-sm px-1">{govError}</p>}
          {govLoading && <p className="text-text-3 text-sm px-1">로딩 중… (USASpending)</p>}
          {!govLoading && (
            <>
              <SignalGrid note="수주 기업별 신호 — score 0~1, 로드된 목록 내 최대 수주기업 대비 상대 규모 (계약 수주는 항상 호재라 단방향)" signals={computeGovSignals(govData)} />
              <Panel>
                <GovTable rows={govData} />
              </Panel>
            </>
          )}
        </>
      )}

      {/* ── Options UOA ─────────────────────────────────────────────────── */}
      {market === "options" && (
        <>
          {uoaError && <p className="text-neg text-sm px-1">{uoaError}</p>}
          {uoaLoading && <p className="text-text-3 text-sm px-1">로딩 중… (옵션체인 스캔)</p>}
          {!uoaLoading && (
            <>
              <SignalGrid note="종목별 옵션 신호 — score -1~+1, 콜/풋 플래그 거래량 쏠림" signals={computeOptionSignals(uoaData)} />
              <Panel>
                <OptionsUOATable rows={uoaData} />
              </Panel>
            </>
          )}
        </>
      )}

      {/* ── Convergence ─────────────────────────────────────────────────── */}
      {market === "convergence" && (
        <>
          <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3">
            <span className="text-text-3 text-xs shrink-0">마켓:</span>
            <SegmentedToggle
              value={convMarket}
              onChange={setConvMarket}
              size="sm"
              options={[
                { value: "kr", label: "KR", activeClass: "border-accent bg-accent text-black" },
                { value: "us", label: "US", activeClass: "border-accent bg-accent text-black" },
              ]}
            />
            <span className="text-text-3 text-xs ml-auto">서로 다른 leg가 같은 티커·같은 방향으로 겹치면 표시 (score = 겹친 leg 종류 수)</span>
          </div>
          {convError && <p className="text-neg text-sm px-1">{convError}</p>}
          {convLoading && <p className="text-text-3 text-sm px-1">로딩 중…</p>}
          {!convLoading && convData.length === 0 && !convError && (
            <Panel className="p-12 text-center">
              <p className="text-text-3 text-sm">컨버전스 신호 없음</p>
            </Panel>
          )}
          {!convLoading && convData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {convData.map(sig => (
                <button
                  key={`${sig.market}:${sig.ticker}:${sig.direction}`}
                  onClick={() => setConvDrawer(sig)}
                  className="text-left bg-panel border border-border rounded-lg p-4 hover:border-accent transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-1 font-data font-semibold">{sig.ticker}</span>
                    <span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${sig.market === "kr" ? "bg-info/15 text-info border-info/25" : "bg-panel-2 text-text-3 border-border"}`}>
                      {sig.market === "kr" ? "KR" : "US"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${sig.direction === "BULLISH" ? "bg-pos/15 text-pos border-pos/25" : "bg-neg/15 text-neg border-neg/25"}`}>
                      {sig.direction === "BULLISH" ? "매수 우세" : "매도 우세"}
                    </span>
                    <span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${sig.score >= 3 ? "bg-accent/15 text-accent border-accent/25" : "bg-warn/15 text-warn border-warn/25"}`}>
                      score {sig.score} {sig.score >= 3 ? "강함" : "주의"}
                    </span>
                    {convOptionScores[sig.ticker] !== undefined && (
                      <span className={`text-xs font-bold rounded px-1.5 py-0.5 border ${convOptionScores[sig.ticker] >= 0 ? "bg-pos/15 text-pos border-pos/25" : "bg-neg/15 text-neg border-neg/25"}`}>
                        옵션 {convOptionScores[sig.ticker] >= 0 ? "+" : ""}{convOptionScores[sig.ticker].toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-text-3 text-xs">
                    {Array.from(new Set(sig.legs.map(l => l.source))).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          )}
          {convDrawer && (
            <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setConvDrawer(null)}>
              <div className="absolute inset-0 bg-black/50" />
              <div className="relative w-full max-w-md bg-panel border-l border-border h-full overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-text-1 font-semibold font-data">
                    {convDrawer.ticker} — {convDrawer.direction === "BULLISH" ? "상승" : "하락"}
                    {convOptionScores[convDrawer.ticker] !== undefined && (
                      <span className={`ml-2 text-xs font-bold ${convOptionScores[convDrawer.ticker] >= 0 ? "text-pos" : "text-neg"}`}>
                        (옵션 {convOptionScores[convDrawer.ticker] >= 0 ? "+" : ""}{convOptionScores[convDrawer.ticker].toFixed(2)})
                      </span>
                    )}
                  </h2>
                  <button onClick={() => setConvDrawer(null)} className="text-text-3 hover:text-text-1">✕</button>
                </div>
                <div className="space-y-3">
                  {convDrawer.legs.map((leg, i) => (
                    <div key={i} className="bg-panel-2 border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-1 text-xs font-semibold">{leg.source}</span>
                        <span className="text-text-3 text-xs font-data">{leg.trade_date}</span>
                      </div>
                      <p className="text-text-2 text-xs">{leg.detail}</p>
                      {leg.url && (
                        <a href={leg.url} target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline mt-1 inline-block">
                          원문 보기 →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── US/KR Error ─────────────────────────────────────────────────── */}
      {market === "us" && usError && <p className="text-neg text-sm px-1">{usError}</p>}
      {market === "kr" && krError && <p className="text-neg text-sm px-1">{krError}</p>}

      {/* ── Loading hint ────────────────────────────────────────────────── */}
      {market === "us" && usLoading && (
        <div className="py-8"><LoadingState message="EDGAR 공시 조회 중…" hint="SEC 응답 5~20초 소요" /></div>
      )}
      {market === "kr" && krLoading && (
        <div className="py-8"><LoadingState message="DART 공시 조회 중…" /></div>
      )}

      {/* ── US/KR Results ───────────────────────────────────────────────── */}
      {(market === "us" || market === "kr") && (filtered.length > 0 || rawData.length > 0) ? (
        <>
        <SignalGrid note={`종목별 매매 신호 — score -1~+1, 매수/매도 건수${market === "us" ? "·금액" : ""} 쏠림`} signals={computeTickerSignals(filtered, market)} />
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
        </>
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

export default function InsiderPage() {
  return <Suspense><InsiderPageInner /></Suspense>;
}
