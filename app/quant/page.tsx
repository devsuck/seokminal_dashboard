"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });
import { InstrumentSelect } from "@/components/InstrumentSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import {
  ApiError, getRisk, getBeta, getRollingBeta, getPortfolioOptimize,
  getFREDCatalog, getFREDSeries,
  getECOSCatalog, getECOSSeries,
  getCorpCrnoCatalog, getCorpFinanceSummary,
  getMonteCarlo, getRegime,
  getEdgarSummary,
  getKSDDividend, getKSDBorrowRank, getKSDRightsSchedule,
  getCVaR, getHurst, getStatTests, getKelly, getVWAP, getGBMMonteCarlo, getHMMRegime, getPairsTrading, getStressTest, getRiskParity, getBlackLitterman, getFactorAttribution,
  type RiskMetricsResponse, type BetaResponse,
  type RollingBetaResponse, type PortfolioOptimizeResponse,
  type FREDCatalogItem, type FREDSeriesResponse,
  type ECOSCatalogItem, type ECOSSeriesResponse,
  type CorpCrnoItem, type CorpFinanceSummaryResponse, type CorpFinancialYear,
  type MonteCarloResponse, type RegimeResponse,
  type EdgarSummaryResponse, type EdgarAnnualRow,
  type KSDDividendResponse, type KSDBorrowResponse, type KSDRightsResponse,
  type CVaRResponse, type HurstResponse, type StatTestsResponse, type KellyResponse, type VWAPResponse, type GBMResponse, type HMMRegimeResponse, type PairsResponse, type StressTestResponse, type RiskParityResponse, type BLView, type BlackLittermanResponse, type FactorAttributionResponse,
} from "@/lib/api";

const ALL_INSTRUMENTS = ["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX", "000660.XKRX"];
const BENCHMARKS = [{ value: "KOSPI.XKRX", label: "KOSPI.XKRX" }, { value: "SPY.ARCA", label: "SPY.ARCA" }];
type Category = "risk" | "simulation" | "portfolio" | "regime" | "statistics" | "macro";
type RiskSub = "metrics" | "beta" | "cvar" | "stress";
type SimSub = "bootstrap" | "gbm";
type PortSub = "correlation" | "markowitz" | "riskparity" | "bl";
type RegimeSub = "rule" | "hmm";
type StatSub = "stattests" | "hurst" | "ff3" | "kelly" | "pairs" | "vwap";
type MacroSub = "us" | "kr";

function pct(v: number | null | undefined, d = 2) { return v == null ? "N/A" : (v * 100).toFixed(d) + "%"; }
function num(v: number | null | undefined, d = 4) { return v == null ? "N/A" : v.toFixed(d); }

function colCls(v: number | null | undefined, invert = false): string {
  if (v == null) return "text-text-3";
  if (invert) return v < 0 ? "text-pos" : "text-neg";
  return v >= 0 ? "text-pos" : "text-neg";
}

function pnlMCCls(v: number | null | undefined): string {
  return v == null ? "text-text-3/50" : v > 1 ? "text-pos" : v > 0 ? "text-warn" : "text-neg";
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-neg text-[13px] mt-0 mb-3">ERR: {msg}</p> : null;
}

// ── Risk ──────────────────────────────────────────────────────────────────────
function RiskTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [benchmarkId, setBenchmarkId] = useState("SPY.ARCA");
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<RiskMetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getRisk(instrumentId, start, end, benchmarkId, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); setResult(null); }
    finally { setLoading(false); }
  }

  const rows = [
    { label: "ANNUALIZED RETURN", val: result ? pct(result.annualized_return) : "—", cls: colCls(result?.annualized_return) },
    { label: "VOLATILITY (ANN.)",  val: result ? pct(result.volatility) : "—",       cls: "text-text-2" },
    { label: "SHARPE RATIO",       val: result ? num(result.sharpe_ratio, 4) : "—",  cls: colCls(result?.sharpe_ratio) },
    { label: "SORTINO RATIO",      val: result ? num(result.sortino_ratio, 4) : "—", cls: colCls(result?.sortino_ratio) },
    { label: "MAX DRAWDOWN",       val: result ? pct(result.max_drawdown) : "—",     cls: result?.max_drawdown != null ? "text-neg" : "text-text-3" },
    { label: "VAR 95% (1-DAY)",    val: result ? pct(result.var_95, 3) : "—",        cls: result ? "text-neg" : "text-text-3/50" },
    { label: "CALMAR RATIO",       val: result ? num(result.calmar_ratio, 4) : "—",  cls: colCls(result?.calmar_ratio) },
    { label: "ALPHA (ANN.)",       val: result ? pct(result.alpha) : "—",            cls: colCls(result?.alpha) },
    { label: "BETA (vs bench)",    val: result?.r_squared != null ? num(result.r_squared, 4) : "—", cls: "text-text-2" },
    { label: "R-SQUARED",          val: result ? num(result.r_squared, 4) : "—",     cls: "text-text-2" },
    { label: "OBSERVATIONS",       val: result ? String(result.observation_count) : "—", cls: "text-text-3/50" },
  ];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">BENCH</span>
        <select value={benchmarkId} onChange={e => setBenchmarkId(e.target.value)}>
          {BENCHMARKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl">
        {rows.map(r => (
          <div key={r.label} className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">{r.label}</div>
            <div className={`text-2xl font-data font-bold tabular-nums ${loading ? "text-text-3/30" : r.cls}`}>
              {loading ? "—" : r.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Factor ────────────────────────────────────────────────────────────────────
function FactorTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [benchmarkId, setBenchmarkId] = useState("SPY.ARCA");
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
  const [window, setWindow] = useState(30);
  const [beta, setBeta] = useState<BetaResponse | null>(null);
  const [rolling, setRolling] = useState<RollingBetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const [b, r] = await Promise.all([
        getBeta(instrumentId, benchmarkId, start, end, ctrl.signal),
        getRollingBeta(instrumentId, benchmarkId, start, end, window, ctrl.signal),
      ]);
      setBeta(b); setRolling(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed"); setBeta(null); setRolling(null);
    } finally { setLoading(false); }
  }

  const pts = rolling?.points ?? [];
  const minB = pts.length ? Math.min(...pts.map(p => p.beta)) : 0;
  const maxB = pts.length ? Math.max(...pts.map(p => p.beta)) : 1;
  const W = 640, H = 140, PX = 24, PY = 16;

  const betaRows = [
    { label: "BETA", val: beta ? num(beta.beta, 4) : "—", cls: "text-text-2" },
    { label: "CORRELATION", val: beta ? num(beta.correlation, 4) : "—", cls: "text-text-2" },
  ];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">BENCH</span>
        <select value={benchmarkId} onChange={e => setBenchmarkId(e.target.value)}>
          {BENCHMARKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <span className="text-accent text-[13px]">WINDOW</span>
        <input type="number" value={window} onChange={e => setWindow(Number(e.target.value))} className="w-12" min={5} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />

      {/* Beta metrics — always visible */}
      <table className="border-collapse w-full max-w-[360px] mb-4">
        <tbody>
          {betaRows.map(r => (
            <tr key={r.label} className="border-b border-border">
              <td className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]">{r.label}</td>
              <td className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : r.cls}`}>{loading ? "..." : r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rolling Beta chart — always visible */}
      <div className="mb-4">
        <div className="text-accent text-sm mb-1">ROLLING BETA ({window}D)</div>
        <svg width={W} height={H} className="block border border-border bg-bg">
          {[0.25, 0.5, 0.75].map(r => (
            <line key={r} x1={PX} y1={PY + r * (H - PY * 2)} x2={W - PX} y2={PY + r * (H - PY * 2)} stroke="#1a1a1a" strokeWidth={1} />
          ))}
          {pts.length > 1 && (() => {
            const y = PY + ((maxB - 1) / (maxB - minB || 1)) * (H - PY * 2);
            return y > PY && y < H - PY ? <line x1={PX} y1={y} x2={W - PX} y2={y} stroke="#333" strokeWidth={1} strokeDasharray="3" /> : null;
          })()}
          {pts.length > 1 && (
            <polyline
              points={pts.map((p, i) => {
                const x = PX + (i / (pts.length - 1)) * (W - PX * 2);
                const y = PY + ((maxB - p.beta) / (maxB - minB || 1)) * (H - PY * 2);
                return `${x},${y}`;
              }).join(" ")}
              fill="none" stroke="#ff8c00" strokeWidth={1.5}
            />
          )}
          {pts.length === 0 && (
            <text x={W / 2} y={H / 2} fontSize={12} fill="#333" textAnchor="middle">RUN TO SEE CHART</text>
          )}
          {pts.length > 1 && <text x={PX + 2} y={PY + 8} fontSize={12} fill="#444">{maxB.toFixed(2)}</text>}
          {pts.length > 1 && <text x={PX + 2} y={H - PY} fontSize={12} fill="#444">{minB.toFixed(2)}</text>}
        </svg>
      </div>

      <CorpFinancePanel />
    </div>
  );
}

// ── Corp Finance Panel ────────────────────────────────────────────────────────
function CorpFinancePanel() {
  const [catalog, setCatalog] = useState<CorpCrnoItem[]>([]);
  const [stockCode, setStockCode] = useState("005930");
  const [customCrno, setCustomCrno] = useState("");
  const [startYear, setStartYear] = useState(2020);
  const [endYear, setEndYear] = useState(2023);
  const [fnclDcd, setFnclDcd] = useState("110");
  const [data, setData] = useState<CorpFinanceSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getCorpCrnoCatalog().then(setCatalog).catch(() => {});
  }, []);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null); setData(null);
    try {
      const res = await getCorpFinanceSummary(stockCode, startYear, endYear, customCrno || undefined, fnclDcd, ctrl.signal);
      setData(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  const hasCrno = catalog.some(c => c.stock_code === stockCode) || !!customCrno;
  const yrs = data?.years ?? [];

  function barChart(label: string, getValue: (y: CorpFinancialYear) => number, color: string) {
    if (!yrs.length) return null;
    const vals = yrs.map(getValue);
    const maxV = Math.max(...vals.map(Math.abs), 1);
    const W = 480, H = 100, PX = 40, PY = 10, barW = Math.max(20, (W - PX * 2) / yrs.length - 8);
    return (
      <div className="mb-4">
        <div className="text-accent text-sm mb-1">{label}</div>
        <svg width={W} height={H} className="block bg-bg border border-border">
          <line x1={PX} y1={H / 2} x2={W - PX} y2={H / 2} stroke="#222" strokeWidth={1} />
          {yrs.map((yr, i) => {
            const v = getValue(yr);
            const x = PX + i * ((W - PX * 2) / yrs.length) + ((W - PX * 2) / yrs.length - barW) / 2;
            const barH = Math.abs(v / maxV) * (H / 2 - PY);
            const y = v >= 0 ? H / 2 - barH : H / 2;
            const c = v >= 0 ? color : "#ff3333";
            return (
              <g key={yr.biz_year}>
                <rect x={x} y={y} width={barW} height={barH} fill={c} opacity={0.8} />
                <text x={x + barW / 2} y={H - 2} fontSize={12} fill="#555" textAnchor="middle">{yr.biz_year}</text>
                <text x={x + barW / 2} y={v >= 0 ? y - 2 : y + barH + 10} fontSize={10} fill={c} textAnchor="middle">
                  {(v / 1e12).toFixed(1)}조
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="text-accent text-[13px] tracking-widest uppercase mb-3">기업 재무정보 (금융위원회 공시)</div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">종목코드</span>
        <select value={stockCode} onChange={e => setStockCode(e.target.value)}>
          {catalog.map(c => <option key={c.stock_code} value={c.stock_code}>{c.stock_code}</option>)}
          <option value="">직접입력</option>
        </select>
        {(!catalog.some(c => c.stock_code === stockCode) || stockCode === "") && (
          <>
            <span className="text-accent text-[13px]">종목코드</span>
            <input value={stockCode} onChange={e => setStockCode(e.target.value)} placeholder="005930" className="w-[70px]" />
            <span className="text-accent text-[13px]">법인등록번호</span>
            <input value={customCrno} onChange={e => setCustomCrno(e.target.value)} placeholder="1301110006246" className="w-[130px]" />
          </>
        )}
        <span className="text-accent text-[13px]">연도</span>
        <input type="number" value={startYear} onChange={e => setStartYear(Number(e.target.value))} className="w-14" />
        <span className="text-text-3/50">~</span>
        <input type="number" value={endYear} onChange={e => setEndYear(Number(e.target.value))} className="w-14" />
        <span className="text-accent text-[13px]">재무제표</span>
        <select value={fnclDcd} onChange={e => setFnclDcd(e.target.value)}>
          <option value="110">연결</option>
          <option value="120">별도</option>
        </select>
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>조회</button>
        {loading && <span className="text-text-3 text-[13px]">LOADING...</span>}
      </div>
      <Err msg={error} />
      {data && yrs.length > 0 && (
        <>
          <div className="text-text-3 text-sm mb-2">
            crno: {data.crno} · {yrs[0]?.report_type}
          </div>
          {/* 재무 요약 테이블 */}
          <div className="overflow-x-auto mb-4">
            <table className="border-collapse text-sm font-data min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-1 text-accent text-sm text-left">항목</th>
                  {yrs.map(y => <th key={y.biz_year} className="px-3 py-1 text-accent text-sm text-right">{y.biz_year}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "매출액", get: (y: CorpFinancialYear) => y.sale_amt },
                  { label: "영업이익", get: (y: CorpFinancialYear) => y.op_profit },
                  { label: "순이익", get: (y: CorpFinancialYear) => y.net_profit },
                  { label: "총자산", get: (y: CorpFinancialYear) => y.total_assets },
                  { label: "총자본", get: (y: CorpFinancialYear) => y.total_equity },
                ].map(row => (
                  <tr key={row.label} className="border-b border-border">
                    <td className="px-3 py-1 text-text-3 text-[13px]">{row.label}</td>
                    {yrs.map(y => {
                      const v = row.get(y);
                      return <td key={y.biz_year} className={`px-3 py-1 text-right ${v >= 0 ? "text-text-2" : "text-neg"}`}>{(v / 1e12).toFixed(2)}조</td>;
                    })}
                  </tr>
                ))}
                {[
                  { label: "영업이익률", get: (y: CorpFinancialYear) => y.op_margin_pct, unit: "%" },
                  { label: "순이익률", get: (y: CorpFinancialYear) => y.net_margin_pct, unit: "%" },
                  { label: "ROE", get: (y: CorpFinancialYear) => y.roe_pct, unit: "%" },
                  { label: "부채비율", get: (y: CorpFinancialYear) => y.debt_ratio_pct, unit: "%" },
                ].map(row => (
                  <tr key={row.label} className="border-b border-border">
                    <td className="px-3 py-1 text-text-3 text-[13px]">{row.label}</td>
                    {yrs.map(y => {
                      const v = row.get(y);
                      const good = row.label === "부채비율" ? (v != null && v < 100) : (v != null && v > 0);
                      return <td key={y.biz_year} className={`px-3 py-1 text-right ${v == null ? "text-text-3/50" : good ? "text-pos" : "text-neg"}`}>
                        {v == null ? "—" : v.toFixed(2) + row.unit}
                      </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 차트 */}
          {barChart("매출액 (조원)", y => y.sale_amt, "#ff8c00")}
          {barChart("영업이익 (조원)", y => y.op_profit, "#00cc44")}
          {barChart("순이익 (조원)", y => y.net_profit, "#4488ff")}
        </>
      )}
    </div>
  );
}

// ── Correlation ───────────────────────────────────────────────────────────────
function CorrelationTab() {
  const [selected, setSelected] = useState(["AAPL.NASDAQ", "MSFT.NASDAQ", "SPY.ARCA"]);
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function toggle(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function run() {
    if (selected.length < 2) { setError("Select ≥2 instruments"); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ instrument_ids: selected.join(","), start, end });
      const res = await fetch(`http://127.0.0.1:8000/correlation?${params}`, { signal: ctrl.signal });
      if (!res.ok) { const b = await res.json(); throw new Error(b.detail); }
      const data = await res.json();
      const m: Record<string, Record<string, number>> = {};
      selected.forEach(a => { m[a] = {}; selected.forEach(b => { m[a][b] = a === b ? 1 : 0; }); });
      for (const { a, b, correlation } of data.pairs) { m[a][b] = correlation; m[b][a] = correlation; }
      setMatrix(m);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed"); setMatrix(null);
    } finally { setLoading(false); }
  }

  function corrBg(v: number): string {
    const a = Math.abs(v).toFixed(2);
    return v >= 0 ? `rgba(0,204,68,${a})` : `rgba(255,51,51,${a})`;
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOLS</span>
        {ALL_INSTRUMENTS.map(id => (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`px-2.5 py-0.5 text-[13px] cursor-pointer border rounded transition-colors ${
              selected.includes(id)
                ? "bg-accent text-black border-accent"
                : "bg-transparent text-text-3 border-border hover:text-text-2"
            }`}
          >{id.split(".")[0]}</button>
        ))}
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>RUN</button>
        {loading && <span className="text-text-3 text-[13px]">COMPUTING...</span>}
      </div>
      <Err msg={error} />
      {!loading && !error && matrix && (
        <>
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1 text-text-3 text-sm font-normal" />
                {selected.map(id => <th key={id} className="px-2 py-1 text-accent text-sm font-normal">{id.split(".")[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {selected.map(a => (
                <tr key={a}>
                  <td className="px-2 py-0.5 text-accent text-sm whitespace-nowrap">{a.split(".")[0]}</td>
                  {selected.map(b => {
                    const v = matrix[a]?.[b] ?? 0;
                    return (
                      <td key={b} className="p-0">
                        <div className="w-24 h-14 flex items-center justify-center border border-border" style={{ background: corrBg(v) }}>
                          <span className={`text-sm font-data font-bold ${Math.abs(v) > 0.5 ? "text-[#000]" : "text-text-3"}`}>{v.toFixed(2)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Gradient legend */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-text-3 text-xs">-1.0</span>
            <div
              className="h-3 w-48 rounded"
              style={{ background: "linear-gradient(to right, rgba(255,51,51,1), rgba(255,51,51,0), rgba(0,204,68,0), rgba(0,204,68,1))" }}
            />
            <span className="text-text-3 text-xs">+1.0</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
function PortfolioTab() {
  const [selected, setSelected] = useState(["AAPL.NASDAQ", "MSFT.NASDAQ", "SPY.ARCA"]);
  const [start, setStart] = useState("2025-06-25");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<PortfolioOptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function toggle(id: string) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function run() {
    if (selected.length < 2) { setError("Select ≥2 instruments"); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getPortfolioOptimize(selected, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); setResult(null); }
    finally { setLoading(false); }
  }

  const frontier = result?.efficient_frontier ?? [];
  const minVol = frontier.length ? Math.min(...frontier.map(p => p.volatility)) : 0;
  const maxVol = frontier.length ? Math.max(...frontier.map(p => p.volatility)) : 1;
  const minRet = frontier.length ? Math.min(...frontier.map(p => p.expected_return)) : 0;
  const maxRet = frontier.length ? Math.max(...frontier.map(p => p.expected_return)) : 1;
  const W = 400, H = 180, PX = 36, PY = 16;
  function fx(v: number) { return PX + ((v - minVol) / (maxVol - minVol || 1)) * (W - PX * 2); }
  function fy(r: number) { return H - PY - ((r - minRet) / (maxRet - minRet || 1)) * (H - PY * 2); }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOLS</span>
        {ALL_INSTRUMENTS.map(id => (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`px-2.5 py-0.5 text-[13px] cursor-pointer border rounded transition-colors ${
              selected.includes(id)
                ? "bg-accent text-black border-accent"
                : "bg-transparent text-text-3 border-border hover:text-text-2"
            }`}
          >{id.split(".")[0]}</button>
        ))}
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>OPTIMIZE</button>
        {loading && <span className="text-text-3 text-[13px]">COMPUTING...</span>}
      </div>
      <Err msg={error} />

      {/* Always-visible portfolio stats — fills on OPTIMIZE */}
      <div className="flex gap-8 flex-wrap">
        {/* Min Variance */}
        <div>
          <div className="text-accent text-sm mb-1.5">MIN VARIANCE PORTFOLIO</div>
          <table className="border-collapse w-full max-w-[560px]">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]">EXP. RETURN</td>
                <td className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : colCls(result?.min_variance.expected_return ?? null)}`}>
                  {loading ? "..." : result ? pct(result.min_variance.expected_return) : "—"}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]">VOLATILITY</td>
                <td className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : "text-text-2"}`}>
                  {loading ? "..." : result ? pct(result.min_variance.volatility) : "—"}
                </td>
              </tr>
              {result
                ? Object.entries(result.min_variance.weights).map(([id, w]) => (
                    <tr key={id} className="border-b border-border">
                      <td className="py-1.5 pr-[72px] text-text-3 text-[13px] w-[220px]">{id}</td>
                      <td className="py-1.5 text-sm font-data font-bold text-text-2">{(w * 100).toFixed(1)}%</td>
                    </tr>
                  ))
                : selected.map(id => (
                    <tr key={id} className="border-b border-border">
                      <td className="py-1.5 pr-[72px] text-text-3/50 text-[13px] w-[220px]">{id}</td>
                      <td className="py-1.5 text-sm font-data font-bold text-text-3/30">—</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Max Sharpe */}
        <div>
          <div className="text-accent text-sm mb-1.5">MAX SHARPE PORTFOLIO</div>
          <table className="border-collapse w-full max-w-[560px]">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]">EXP. RETURN</td>
                <td className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : colCls(result?.max_sharpe.expected_return ?? null)}`}>
                  {loading ? "..." : result ? pct(result.max_sharpe.expected_return) : "—"}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]">VOLATILITY</td>
                <td className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : "text-text-2"}`}>
                  {loading ? "..." : result ? pct(result.max_sharpe.volatility) : "—"}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1.5 pr-[72px] text-accent text-[13px] w-[220px]">SHARPE</td>
                <td className={`py-1.5 text-sm font-data font-bold ${loading ? "text-text-3/30" : colCls(result?.max_sharpe.sharpe ?? null)}`}>
                  {loading ? "..." : result ? num(result.max_sharpe.sharpe ?? null, 4) : "—"}
                </td>
              </tr>
              {result
                ? Object.entries(result.max_sharpe.weights).map(([id, w]) => (
                    <tr key={id} className="border-b border-border">
                      <td className="py-1.5 pr-[72px] text-text-3 text-[13px] w-[220px]">{id}</td>
                      <td className="py-1.5 text-sm font-data font-bold text-text-2">{(w * 100).toFixed(1)}%</td>
                    </tr>
                  ))
                : selected.map(id => (
                    <tr key={id} className="border-b border-border">
                      <td className="py-1.5 pr-[72px] text-text-3/50 text-[13px] w-[220px]">{id}</td>
                      <td className="py-1.5 text-sm font-data font-bold text-text-3/30">—</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Efficient Frontier — always visible */}
        <div>
          <div className="text-accent text-sm mb-1.5">EFFICIENT FRONTIER</div>
          <svg width={W} height={H} className="block bg-bg border border-border">
            {frontier.length > 1 ? <>
              <polyline points={frontier.map(p => `${fx(p.volatility)},${fy(p.expected_return)}`).join(" ")} fill="none" stroke="#ff8c00" strokeWidth={1.5} />
              <circle cx={fx(result!.min_variance.volatility)} cy={fy(result!.min_variance.expected_return)} r={4} fill="#00cc44" />
              <circle cx={fx(result!.max_sharpe.volatility)} cy={fy(result!.max_sharpe.expected_return)} r={4} fill="#4488ff" />
              <text x={PX} y={H - 4} fontSize={12} fill="#333">{pct(minVol, 1)}</text>
              <text x={W - PX - 20} y={H - 4} fontSize={12} fill="#333">{pct(maxVol, 1)}</text>
              <text x={4} y={PY + 4} fontSize={12} fill="#333">{pct(maxRet, 1)}</text>
              <text x={4} y={H - PY} fontSize={12} fill="#333">{pct(minRet, 1)}</text>
              <text x={PX + 48} y={H - 4} fontSize={12} fill="#555">VOL →</text>
            </> : (
              <text x={W / 2} y={H / 2} fontSize={12} fill="#333" textAnchor="middle">
                {loading ? "COMPUTING..." : "OPTIMIZE TO SEE FRONTIER"}
              </text>
            )}
          </svg>
          <div className="flex gap-4 mt-1 text-sm text-text-3/50">
            <span><span className="text-pos">●</span> MIN VAR</span>
            <span><span style={{ color: "#4488ff" }}>●</span> MAX SHARPE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Macro ─────────────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  rates: "INTEREST RATES", macro: "MACRO INDICATORS",
  volatility: "VOLATILITY", credit: "CREDIT", fx: "FX",
};

const W = 640, PX = 48, PY = 12, H = 120;

function mkPts(obs: { date: string; value: number | null }[]) {
  const clean = obs.filter(o => o.value != null) as { date: string; value: number }[];
  if (clean.length < 2) return { pts: [], mn: 0, mx: 1 };
  const mn = Math.min(...clean.map(o => o.value));
  const mx = Math.max(...clean.map(o => o.value));
  const rng = mx - mn || 1;
  const n = clean.length;
  return {
    pts: clean.map((o, i) => ({
      x: PX + (i / (n - 1)) * (W - PX * 2),
      y: PY + ((mx - o.value) / rng) * (H - PY * 2),
    })),
    mn, mx,
  };
}

function MiniSeriesChart({ s }: { s: { series_id: string; label: string; unit: string; observations: { date: string; value: number | null }[] } }) {
  const { pts, mn, mx } = mkPts(s.observations);
  const last = s.observations.filter(o => o.value != null).at(-1);
  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-accent text-sm">{s.series_id}</span>
        <span className="text-text-3 text-[13px]">{s.label}</span>
        {last && <span className="text-text-2 text-sm font-data font-bold">{last.value?.toFixed(2)} {s.unit}</span>}
      </div>
      <svg width={W} height={H} className="block bg-bg border border-border">
        {[0.25, 0.5, 0.75].map(r => <line key={r} x1={PX} y1={PY + r * (H - PY * 2)} x2={W - PX} y2={PY + r * (H - PY * 2)} stroke="#1a1a1a" strokeWidth={1} />)}
        {pts.length > 1 && <polyline points={pts.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#ff8c00" strokeWidth={1.5} />}
        <text x={4} y={PY + 8} fontSize={12} fill="#444">{mx.toFixed(2)}</text>
        <text x={4} y={H - PY + 2} fontSize={12} fill="#444">{mn.toFixed(2)}</text>
        {s.observations.length > 0 && (
          <>
            <text x={PX} y={H - 2} fontSize={10} fill="#333">{s.observations.find(o => o.value != null)?.date}</text>
            <text x={W - PX - 40} y={H - 2} fontSize={10} fill="#333">{last?.date}</text>
          </>
        )}
      </svg>
    </div>
  );
}

function FREDPanel() {
  const [catalog, setCatalog] = useState<FREDCatalogItem[]>([]);
  const [selected, setSelected] = useState<string[]>(["DGS10", "DGS2", "FEDFUNDS", "VIXCLS", "UNRATE"]);
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2025-12-31");
  const [series, setSeries] = useState<Record<string, FREDSeriesResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { getFREDCatalog().then(setCatalog).catch(() => {}); }, []);

  async function run() {
    if (!selected.length) return;
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const results = await Promise.all(selected.map(id => getFREDSeries(id, start, end, ctrl.signal)));
      const map: Record<string, FREDSeriesResponse> = {};
      results.forEach(r => { map[r.series_id] = r; });
      setSeries(map);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const categories = [...new Set(catalog.map(c => c.category))];

  return (
    <div>
      <div className="text-text-3 text-[13px] mb-3.5">세인트루이스 연준 거시 경제 지표 — 지표 선택 후 FETCH</div>
      {categories.map(cat => (
        <div key={cat} className="mb-3">
          <div className="text-accent text-[11px] tracking-widest mb-1.5">{CATEGORY_LABEL[cat] ?? cat.toUpperCase()}</div>
          <div className="flex gap-1 flex-wrap">
            {catalog.filter(c => c.category === cat).map(item => (
              <button
                key={item.series_id}
                onClick={() => toggle(item.series_id)}
                title={item.label}
                className={`px-2.5 py-1 text-[13px] cursor-pointer border rounded transition-colors ${
                  selected.includes(item.series_id)
                    ? "bg-accent text-black border-accent"
                    : "bg-panel text-text-3 border-border hover:text-text-2"
                }`}
              >{item.series_id}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-3 items-center mb-3.5 flex-wrap mt-2">
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>FETCH</button>
        {loading && <span className="text-text-3 text-[13px]">LOADING...</span>}
      </div>
      {error && <p className="text-neg text-[13px] mt-0 mb-3">ERR: {error}</p>}
      {Object.values(series).map(s => <MiniSeriesChart key={s.series_id} s={s} />)}
    </div>
  );
}

function ECOSPanel() {
  const [catalog, setCatalog] = useState<ECOSCatalogItem[]>([]);
  const [selected, setSelected] = useState<string[]>(["BOK_BASE_RATE", "KOSPI", "CPI", "KRW_USD", "UNEMP_RATE"]);
  const [start, setStart] = useState("202001");
  const [end, setEnd] = useState("202506");
  const [series, setSeries] = useState<Record<string, ECOSSeriesResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { getECOSCatalog().then(setCatalog).catch(() => {}); }, []);

  async function run() {
    if (!selected.length) return;
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      const results = await Promise.all(selected.map(id => getECOSSeries(id, start, end, ctrl.signal)));
      const map: Record<string, ECOSSeriesResponse> = {};
      results.forEach(r => { map[r.series_id] = r; });
      setSeries(map);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
    } finally { setLoading(false); }
  }

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const categories = [...new Set(catalog.map(c => c.category))];

  return (
    <div>
      <div className="text-text-3 text-[13px] mb-1.5">한국은행 거시 경제 지표 — 지표 선택 후 FETCH</div>
      <div className="text-text-3 text-xs mb-3.5">날짜 형식: YYYYMM (월) · YYYY (연) · YYYYQn (분기)</div>
      {categories.map(cat => (
        <div key={cat} className="mb-3">
          <div className="text-accent text-[11px] tracking-widest mb-1.5">{CATEGORY_LABEL[cat] ?? cat.toUpperCase()}</div>
          <div className="flex gap-1 flex-wrap">
            {catalog.filter(c => c.category === cat).map(item => (
              <button
                key={item.series_id}
                onClick={() => toggle(item.series_id)}
                title={item.label}
                className={`px-2.5 py-1 text-[13px] cursor-pointer border rounded transition-colors ${
                  selected.includes(item.series_id)
                    ? "bg-accent text-black border-accent"
                    : "bg-panel text-text-3 border-border hover:text-text-2"
                }`}
              >{item.series_id}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-3 items-center mb-3.5 flex-wrap mt-2">
        <span className="text-accent text-[13px]">PERIOD</span>
        <input value={start} onChange={e => setStart(e.target.value)} placeholder="202001" className="w-20" />
        <span className="text-text-3 text-[13px]">~</span>
        <input value={end} onChange={e => setEnd(e.target.value)} placeholder="202506" className="w-20" />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>FETCH</button>
        {loading && <span className="text-text-3 text-[13px]">LOADING...</span>}
      </div>
      {error && <p className="text-neg text-[13px] mt-0 mb-3">ERR: {error}</p>}
      {Object.values(series).map(s => (
        <MiniSeriesChart key={s.series_id} s={{ ...s, observations: s.observations }} />
      ))}
    </div>
  );
}


// ── KSD ──────────────────────────────────────────────────────────────────────
const RGH_EXR_LABELS: Record<string, string> = {
  "01": "배당", "10": "무상증자", "20": "유상증자",
  "30": "합병", "40": "분할", "50": "감자",
};

function KSDPanel() {
  const [mode, setMode] = useState<"dividend" | "borrow" | "rights">("dividend");
  const [stockCode, setStockCode] = useState("005930");
  const [basDt, setBasDt] = useState("20250101");
  const [beginDt, setBeginDt] = useState("20230101");
  const [endDt, setEndDt] = useState("20251231");
  const [divResult, setDivResult] = useState<KSDDividendResponse | null>(null);
  const [borrowResult, setBorrowResult] = useState<KSDBorrowResponse | null>(null);
  const [rightsResult, setRightsResult] = useState<KSDRightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try {
      if (mode === "dividend") {
        setDivResult(await getKSDDividend(stockCode, beginDt, endDt, ctrl.signal));
      } else if (mode === "borrow") {
        setBorrowResult(await getKSDBorrowRank(basDt, 30, ctrl.signal));
      } else {
        setRightsResult(await getKSDRightsSchedule(undefined, beginDt, endDt, undefined, ctrl.signal));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof ApiError ? e.message : String(e);
      setError(msg);
    } finally { setLoading(false); }
  }

  const PENDING_MSG = "KSD API 승인 대기 중 — data.go.kr 마이페이지에서 승인 상태 확인";

  return (
    <div>
      <div className="text-text-3 text-[13px] mb-3.5">한국예탁결제원 — 배당 · 대차 · 권리일정</div>

      {/* 모드 탭 */}
      <div className="flex border-b border-border mb-2.5">
        {(["dividend", "borrow", "rights"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3.5 py-0.5 text-sm cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
              mode === m
                ? "border-accent text-accent font-bold"
                : "border-transparent text-text-3 font-normal hover:text-text-1"
            }`}
          >
            {m === "dividend" ? "배당정보" : m === "borrow" ? "대차순위" : "권리일정"}
          </button>
        ))}
      </div>

      {/* 입력 */}
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        {mode === "dividend" && <>
          <span className="text-accent text-[13px]">종목코드</span>
          <input value={stockCode} onChange={e => setStockCode(e.target.value)} placeholder="005930" className="w-20" />
        </>}
        {mode === "borrow" ? <>
          <span className="text-accent text-[13px]">기준일</span>
          <input value={basDt} onChange={e => setBasDt(e.target.value)} placeholder="20250101" className="w-[90px]" />
        </> : <>
          <span className="text-accent text-[13px]">시작</span>
          <input value={beginDt} onChange={e => setBeginDt(e.target.value)} className="w-[90px]" />
          <span className="text-text-3 text-[13px]">~</span>
          <input value={endDt} onChange={e => setEndDt(e.target.value)} className="w-[90px]" />
        </>}
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>{loading ? "FETCHING..." : "FETCH"}</button>
      </div>

      {error && (
        <div className={`text-[13px] mb-2 px-2.5 py-1.5 bg-panel border border-border ${error.includes("승인 대기") ? "text-accent" : "text-neg"}`}>
          {error.includes("승인 대기") ? `⏳ ${PENDING_MSG}` : `ERR: ${error}`}
        </div>
      )}

      {/* 배당 테이블 */}
      {mode === "dividend" && (
        <table className="border-collapse w-full max-w-[680px]">
          <thead><tr>
            {["종목명", "배당기준일", "현금배당지급일", "주당배당금", "현금배당률", "주식종류"].map(h => (
              <th key={h} className="py-1 pr-3 text-accent text-sm text-left border-b border-border whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {divResult && divResult.rows.length > 0 ? divResult.rows.map((r, i) => (
              <tr key={i}>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-3">{r.isin_cd_nm ?? r.isin_cd ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.dvdn_bas_dt ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.cash_dvdn_pay_dt ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-accent">{r.stck_genr_dvdn_amt ? Number(r.stck_genr_dvdn_amt).toLocaleString() + "원" : "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.stck_genr_cash_dvdn_rt ? r.stck_genr_cash_dvdn_rt + "%" : "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.scrs_itms_kcd_nm ?? "—"}</td>
              </tr>
            )) : <tr><td colSpan={6} className="p-4 text-sm font-data border-b border-border text-text-3/50 text-center">
              {loading ? "FETCHING..." : "종목코드 입력 후 FETCH"}
            </td></tr>}
          </tbody>
        </table>
      )}

      {/* 대차 순위 */}
      {mode === "borrow" && (
        <table className="border-collapse w-full max-w-[600px]">
          <thead><tr>
            {["순위", "ISIN", "종목명", "대차체결주식수", "대차잔여주식수", "대차잔액"].map(h => (
              <th key={h} className="py-1 pr-3 text-accent text-sm text-left border-b border-border whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {borrowResult && borrowResult.rows.length > 0 ? borrowResult.rows.map((r, i) => (
              <tr key={i}>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-accent">{r.rank}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-3">{r.isin_cd ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.isin_cd_nm ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.lnb_ccl_stck_cnt ? Number(r.lnb_ccl_stck_cnt).toLocaleString() : "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.lnb_rman_stck_cnt ? Number(r.lnb_rman_stck_cnt).toLocaleString() : "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.lnb_bal ? Number(r.lnb_bal).toLocaleString() + "원" : "—"}</td>
              </tr>
            )) : <tr><td colSpan={6} className="p-4 text-sm font-data border-b border-border text-text-3/50 text-center">
              {loading ? "FETCHING..." : "기준일 입력 후 FETCH"}
            </td></tr>}
          </tbody>
        </table>
      )}

      {/* 권리일정 */}
      {mode === "rights" && (
        <table className="border-collapse w-full max-w-[780px]">
          <thead><tr>
            {["기준일", "발행회사", "발행사유", "권리행사사유", "권리행사시작일", "권리행사종료일", "명부폐쇄시작"].map(h => (
              <th key={h} className="py-1 pr-3 text-accent text-sm text-left border-b border-border whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rightsResult && rightsResult.rows.length > 0 ? rightsResult.rows.map((r, i) => (
              <tr key={i}>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-3">{r.bas_dt ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.stck_issu_cmpy_nm ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.stck_issu_rcd_nm ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-accent">{r.rgt_exert_rcd_nm ?? r.rgt_exert_rcd ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.rgt_exert_sttg_dt ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.rgt_exert_ed_dt ?? "—"}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-text-2">{r.nmls_lck_sttg_dt ?? "—"}</td>
              </tr>
            )) : <tr><td colSpan={7} className="p-4 text-sm font-data border-b border-border text-text-3/50 text-center">
              {loading ? "FETCHING..." : "시작/종료일 입력 후 FETCH"}
            </td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── EDGAR ─────────────────────────────────────────────────────────────────────
const EDGAR_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM", "V", "XOM"];

function EdgarPanel() {
  const [ticker, setTicker] = useState("AAPL");
  const [customTicker, setCustomTicker] = useState("");
  const [startYear, setStartYear] = useState(2019);
  const [endYear, setEndYear]   = useState(2024);
  const [result, setResult]     = useState<EdgarSummaryResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    const t = customTicker.trim().toUpperCase() || ticker;
    try { setResult(await getEdgarSummary(t, startYear, endYear, ctrl.signal)); }
    catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof ApiError ? e.message : "Failed");
      setResult(null);
    } finally { setLoading(false); }
  }

  const fmt = (v: number | null, unit: "B" | "pct" | "plain" = "B") => {
    if (v == null) return <span className="text-text-3/50">—</span>;
    if (unit === "B") return <span className="text-text-2">{(v / 1e9).toFixed(1)}B</span>;
    if (unit === "pct") return <span className={v >= 0 ? "text-pos" : "text-neg"}>{v.toFixed(1)}%</span>;
    return <span className="text-text-2">{v.toFixed(2)}</span>;
  };

  return (
    <div>
      <div className="text-text-3 text-[13px] mb-3.5">미국 기업 XBRL 재무제표 — SEC EDGAR 무료 데이터</div>
      <div className="flex gap-1.5 flex-wrap mb-2.5">
        {EDGAR_TICKERS.map(t => (
          <button
            key={t}
            onClick={() => { setTicker(t); setCustomTicker(""); }}
            className={`px-2.5 py-1 text-[13px] cursor-pointer border rounded transition-colors ${
              ticker === t && !customTicker
                ? "bg-accent text-black border-accent"
                : "bg-panel text-text-3 border-border hover:text-text-2"
            }`}
          >{t}</button>
        ))}
      </div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap mt-1">
        <span className="text-accent text-[13px]">TICKER</span>
        <input value={customTicker} onChange={e => setCustomTicker(e.target.value.toUpperCase())}
          placeholder="커스텀 (예: NFLX)" className="w-[90px]" />
        <span className="text-accent text-[13px]">YEAR</span>
        <input type="number" value={startYear} onChange={e => setStartYear(Number(e.target.value))}
          className="w-14" />
        <span className="text-text-3 text-[13px]">~</span>
        <input type="number" value={endYear} onChange={e => setEndYear(Number(e.target.value))}
          className="w-14" />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>{loading ? "FETCHING..." : "FETCH"}</button>
        {result && <span className="text-text-3/50 text-sm">CIK: {result.cik}</span>}
      </div>
      {error && <p className="text-neg text-[13px] mt-0 mb-3">ERR: {error}</p>}
      <div className="overflow-x-auto">
        <table className="border-collapse w-full min-w-[700px]">
          <thead>
            <tr>
              {["YEAR","REVENUE","GROSS PROFIT","OP INCOME","NET INCOME","TOTAL ASSETS","EQUITY","L-T DEBT","EPS","OP MGN","NET MGN","ROE"].map(h => (
                <th key={h} className="py-1 pr-3 text-accent text-sm text-left border-b border-border whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result && result.rows.length > 0 ? result.rows.map(r => (
              <tr key={r.year}>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border text-accent">{r.year}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.revenue, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.gross_profit, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.op_income, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.net_income, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.total_assets, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.equity, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.long_term_debt, "B")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.eps_diluted, "plain")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.op_margin_pct, "pct")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.net_margin_pct, "pct")}</td>
                <td className="py-[5px] pr-3 text-sm font-data border-b border-border">{fmt(r.roe_pct, "pct")}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={12} className="p-4 text-sm font-data border-b border-border text-text-3/50 text-center">
                  {loading ? "FETCHING..." : "SELECT TICKER AND FETCH"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Monte Carlo ───────────────────────────────────────────────────────────────
function MonteCarloTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2025-12-31");
  const [horizon, setHorizon] = useState(252);
  const [nSim, setNSim] = useState(1000);
  const [result, setResult] = useState<MonteCarloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [view, setView] = useState<"fan" | "3d">("fan");

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getMonteCarlo(instrumentId, start, end, horizon, nSim, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); setResult(null); }
    finally { setLoading(false); }
  }

  const CW = 640, CH = 200, CPX = 20, CPY = 12;
  const days = result?.day_indices ?? [];
  const paths = result?.paths;
  const allVals = paths ? [...paths.p5, ...paths.p95] : [];
  const minV = allVals.length ? Math.min(...allVals) : 0.5;
  const maxV = allVals.length ? Math.max(...allVals) : 2.0;

  function pathPts(series: number[]) {
    if (!series.length || !days.length) return "";
    return series.map((v, i) => {
      const x = CPX + (days[i] / (horizon || 1)) * (CW - CPX * 2);
      const y = CPY + ((maxV - v) / (maxV - minV || 1)) * (CH - CPY * 2);
      return `${x},${y}`;
    }).join(" ");
  }

  const stats = [
    { label: "PROB PROFIT",   val: result ? (result.prob_profit * 100).toFixed(1) + "%" : "—", cls: result ? (result.prob_profit > 0.5 ? "text-pos" : "text-neg") : "text-text-3/50" },
    { label: "PROB LOSS 20%", val: result ? (result.prob_loss_20pct * 100).toFixed(1) + "%" : "—", cls: result?.prob_loss_20pct != null ? "text-neg" : "text-text-3/50" },
    { label: "MEDIAN (final)", val: result ? result.terminal_median.toFixed(3) : "—", cls: pnlMCCls(result?.terminal_median) },
    { label: "P5 (final)",    val: result ? result.terminal_p5.toFixed(3) : "—",    cls: "text-neg" },
    { label: "P95 (final)",   val: result ? result.terminal_p95.toFixed(3) : "—",   cls: "text-pos" },
    { label: "ANN RETURN (mean)", val: result ? pct(result.ann_return_mean) : "—", cls: pnlMCCls(result?.ann_return_mean) },
    { label: "ANN RET P5",   val: result ? pct(result.ann_return_p5) : "—",  cls: "text-neg" },
    { label: "ANN RET P95",  val: result ? pct(result.ann_return_p95) : "—", cls: "text-pos" },
    { label: "MAX DD (mean)", val: result ? pct(result.max_dd_mean) : "—",   cls: "text-warn" },
    { label: "MAX DD P95",   val: result ? pct(result.max_dd_p95) : "—",    cls: "text-neg" },
  ];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">TRAIN DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <span className="text-accent text-[13px]">HORIZON</span>
        <input type="number" value={horizon} onChange={e => setHorizon(Number(e.target.value))} className="w-14" min={20} max={1260} />
        <span className="text-text-3 text-[13px]">days</span>
        <span className="text-accent text-[13px]">SIMS</span>
        <input type="number" value={nSim} onChange={e => setNSim(Number(e.target.value))} className="w-16" min={100} max={5000} step={100} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>{loading ? "SIMULATING..." : "RUN"}</button>
        <div className="flex rounded overflow-hidden border border-border">
          {(["fan", "3d"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs cursor-pointer border-0 transition-colors ${
                view === v ? "bg-accent text-black font-bold" : "bg-transparent text-text-3 hover:text-text-1"
              }`}
            >
              {v === "fan" ? "FAN" : "3D"}
            </button>
          ))}
        </div>
      </div>
      <Err msg={error} />

      {/* Summary stats — always visible */}
      <div className="flex gap-5 flex-wrap mb-4">
        {stats.map(s => (
          <div key={s.label} className="min-w-[90px]">
            <div className="text-accent text-[13px] tracking-wide mb-0.5">{s.label}</div>
            <div className={`text-[15px] font-data font-bold ${s.cls}`}>{loading ? "..." : s.val}</div>
          </div>
        ))}
      </div>

      {/* View: Fan Chart or 3D Surface */}
      <div className="mb-2">
        {view === "fan" ? (
          <>
            <div className="flex gap-3 text-[13px] text-text-3/50 mb-1">
              <span><span style={{ color: "#ff3333" }}>— P5</span></span>
              <span><span style={{ color: "#ff8844" }}>— P25</span></span>
              <span><span style={{ color: "#e8e8e8" }}>— P50</span></span>
              <span><span style={{ color: "#44cc88" }}>— P75</span></span>
              <span><span style={{ color: "#00cc44" }}>— P95</span></span>
            </div>
            <svg width={CW} height={CH} className="block bg-bg border border-border">
              {[0.25, 0.5, 0.75].map(r => <line key={r} x1={CPX} y1={CPY + r * (CH - CPY * 2)} x2={CW - CPX} y2={CPY + r * (CH - CPY * 2)} stroke="#1a1a1a" strokeWidth={1} />)}
              {/* baseline 1.0 */}
              {(() => {
                const y1 = CPY + ((maxV - 1) / (maxV - minV || 1)) * (CH - CPY * 2);
                return <line x1={CPX} y1={y1} x2={CW - CPX} y2={y1} stroke="#333" strokeWidth={1} strokeDasharray="4" />;
              })()}
              {paths && days.length > 0 ? <>
                <polygon
                  points={`${pathPts(paths.p25)} ${paths.p75.map((v, i) => { const x = CPX + (days[days.length - 1 - i] / (horizon || 1)) * (CW - CPX * 2); const y = CPY + ((maxV - v) / (maxV - minV || 1)) * (CH - CPY * 2); return `${x},${y}`; }).join(" ")}`}
                  fill="#ff8c00" opacity={0.07}
                />
                {[
                  { d: paths.p5,  s: "#ff3333", w: 1 },
                  { d: paths.p25, s: "#ff8844", w: 1 },
                  { d: paths.p50, s: "#e8e8e8", w: 1.5 },
                  { d: paths.p75, s: "#44cc88", w: 1 },
                  { d: paths.p95, s: "#00cc44", w: 1 },
                ].map(({ d, s, w }) => <polyline key={s} points={pathPts(d)} fill="none" stroke={s} strokeWidth={w} />)}
                <text x={CPX + 2} y={CPY + 8} fontSize={12} fill="#444">{maxV.toFixed(2)}</text>
                <text x={CPX + 2} y={CH - CPY} fontSize={12} fill="#444">{minV.toFixed(2)}</text>
              </> : (
                <text x={CW / 2} y={CH / 2} fontSize={12} fill="#333" textAnchor="middle">RUN SIMULATION TO SEE FAN CHART</text>
              )}
            </svg>
          </>
        ) : (
          <div style={{ height: "420px" }} className="w-full rounded-lg overflow-hidden border border-border">
            {paths && days.length > 0 ? (
              <Plot
                data={[
                  {
                    type: "surface" as const,
                    x: days,
                    y: [5, 25, 50, 75, 95],
                    z: [paths.p5, paths.p25, paths.p50, paths.p75, paths.p95],
                    colorscale: [
                      [0, "#EF4444"],
                      [0.25, "#F97316"],
                      [0.5, "#FF9F1C"],
                      [0.75, "#84CC16"],
                      [1, "#22C55E"],
                    ],
                    showscale: false,
                    opacity: 0.92,
                    contours: {
                      z: { show: true, usecolormap: true, highlightcolor: "#FF9F1C", project: { z: true } },
                    },
                  } as never,
                ]}
                layout={{
                  paper_bgcolor: "#0F131A",
                  plot_bgcolor: "#0F131A",
                  scene: {
                    xaxis: { title: "Day", color: "#5F6B7A", gridcolor: "#1E2530", backgroundcolor: "#0F131A", showbackground: true },
                    yaxis: { title: "Percentile", color: "#5F6B7A", gridcolor: "#1E2530", backgroundcolor: "#0F131A", showbackground: true },
                    zaxis: { title: "Price (norm.)", color: "#5F6B7A", gridcolor: "#1E2530", backgroundcolor: "#0F131A", showbackground: true },
                    camera: { eye: { x: 1.6, y: -1.6, z: 0.8 } },
                  },
                  margin: { l: 0, r: 0, t: 0, b: 0 },
                  font: { family: "'JetBrains Mono', monospace", size: 10, color: "#5F6B7A" },
                } as never}
                style={{ width: "100%", height: "420px" }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-3 text-sm">
                RUN SIMULATION TO SEE 3D SURFACE
              </div>
            )}
          </div>
        )}
      </div>
      <div className="text-text-3/50 text-sm">
        Bootstrap resampling (numpy) · historical returns → {nSim.toLocaleString()} simulated paths · horizon {horizon} days
      </div>
    </div>
  );
}

// ── Regime Filter ─────────────────────────────────────────────────────────────
const REGIME_COLORS: Record<string, string> = {
  bull_low_vol:  "#00cc44",
  bull_high_vol: "#ff8c00",
  bear_low_vol:  "#4488ff",
  bear_high_vol: "#ff3333",
};

const REGIME_CLS: Record<string, string> = {
  bull_low_vol:  "text-pos",
  bull_high_vol: "text-accent",
  bear_low_vol:  "text-info",
  bear_high_vol: "text-neg",
};

function RegimeTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2025-12-31");
  const [smaPeriod, setSmaPeriod] = useState(50);
  const [volPeriod, setVolPeriod] = useState(20);
  const [result, setResult] = useState<RegimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getRegime(instrumentId, start, end, smaPeriod, volPeriod, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); setResult(null); }
    finally { setLoading(false); }
  }

  const RW = 640, RH = 60;
  const pts = result?.regimes ?? [];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <span className="text-accent text-[13px]">SMA</span>
        <input type="number" value={smaPeriod} onChange={e => setSmaPeriod(Number(e.target.value))} className="w-12" min={5} max={200} />
        <span className="text-accent text-[13px]">VOL</span>
        <input type="number" value={volPeriod} onChange={e => setVolPeriod(Number(e.target.value))} className="w-12" min={5} max={60} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 transition-all border-0" onClick={run}>{loading ? "DETECTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />

      {/* Current regime card */}
      <div className="flex gap-6 mb-4 flex-wrap">
        {[
          { label: "CURRENT REGIME", val: result?.current_regime?.toUpperCase().replace(/_/g, " / ") ?? "—", cls: result ? "" : "text-text-3/50", style: result ? { color: REGIME_COLORS[result.current_regime] } : undefined },
          { label: "CURRENT VOL (ANN.)", val: result?.current_vol != null ? (result.current_vol * 100).toFixed(2) + "%" : "—", cls: "text-text-2", style: undefined },
          { label: "VOL THRESHOLD", val: result ? (result.vol_threshold * 100).toFixed(2) + "%" : "—", cls: "text-text-3", style: undefined },
          { label: "SMA PERIOD", val: result ? String(result.sma_period) : "—", cls: "text-text-3/50", style: undefined },
        ].map(s => (
          <div key={s.label}>
            <div className="text-accent text-[13px] tracking-wide mb-0.5">{s.label}</div>
            <div className={`text-[15px] font-data font-bold ${s.cls}`} style={s.style}>{loading ? "..." : s.val}</div>
          </div>
        ))}
      </div>

      {/* Regime timeline strip */}
      <div className="mb-4">
        <div className="text-accent text-sm mb-1">REGIME TIMELINE</div>
        <svg width={RW} height={RH} className="block bg-bg border border-border">
          {pts.length > 1 ? pts.map((p, i) => {
            const x = Math.floor((i / pts.length) * RW);
            const w = Math.ceil(RW / pts.length) + 1;
            return <rect key={i} x={x} y={0} width={w} height={RH} fill={REGIME_COLORS[p.regime] ?? "#444"} opacity={0.7} />;
          }) : (
            <text x={RW / 2} y={RH / 2} fontSize={12} fill="#333" textAnchor="middle">RUN TO SEE TIMELINE</text>
          )}
        </svg>
        <div className="flex gap-4 mt-1.5 text-[13px]">
          {Object.entries(REGIME_COLORS).map(([name, color]) => (
            <span key={name}><span style={{ color }}>■</span> {name.replace(/_/g, " / ").toUpperCase()}</span>
          ))}
        </div>
      </div>

      {/* Regime distribution table */}
      <div className="mb-4">
        <div className="text-accent text-sm mb-1.5">REGIME DISTRIBUTION</div>
        <table className="border-collapse w-full max-w-[400px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1.5 pr-[72px] text-accent text-sm w-[220px]">REGIME</th>
              <th className="py-1.5 text-sm font-data font-bold text-accent">% OF TIME</th>
            </tr>
          </thead>
          <tbody>
            {result ? Object.entries(result.regime_distribution).sort((a, b) => b[1] - a[1]).map(([name, frac]) => (
              <tr key={name} className="border-b border-border">
                <td className={`py-1.5 pr-[72px] text-[13px] w-[220px] ${REGIME_CLS[name] ?? "text-text-3"}`}>{name.replace(/_/g, " / ").toUpperCase()}</td>
                <td className={`py-1.5 text-sm font-data font-bold ${REGIME_CLS[name] ?? "text-text-3"}`}>{(frac * 100).toFixed(1)}%</td>
              </tr>
            )) : (
              <tr><td colSpan={2} className="text-sm font-data font-bold text-text-3/50 text-center p-4">RUN TO SEE DISTRIBUTION</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-text-3/50 text-sm">
        Bull / Bear: price vs SMA{smaPeriod} · Low / High vol: {volPeriod}-day rolling annualised volatility vs historical median
      </div>
    </div>
  );
}

// ── CVaR / Expected Shortfall ──────────────────────────────────────────────────
function CVaRTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<CVaRResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getCVaR(instrumentId, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const cards = result ? [
    { label: "VaR 95% (1-day)", val: pct(result.var_95, 3), cls: "text-neg" },
    { label: "CVaR 95% (ES)", val: pct(result.cvar_95, 3), cls: "text-neg" },
    { label: "VaR 99% (1-day)", val: pct(result.var_99, 3), cls: "text-neg" },
    { label: "CVaR 99% (ES)", val: pct(result.cvar_99, 3), cls: "text-neg" },
  ] : [];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">CVaR (Expected Shortfall) = average loss beyond VaR threshold. More conservative than VaR.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
        {cards.map(c => (
          <div key={c.label} className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">{c.label}</div>
            <div className={`text-2xl font-data font-bold tabular-nums ${loading ? "text-text-3/30" : c.cls}`}>{loading ? "—" : c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hurst Exponent ─────────────────────────────────────────────────────────────
function HurstTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<HurstResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getHurst(instrumentId, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const hurstCls = result ? (result.hurst > 0.55 ? "text-pos" : result.hurst < 0.45 ? "text-accent" : "text-warn") : "text-text-3/30";

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Hurst Exponent H: H&gt;0.55 = trending, H&lt;0.45 = mean-reverting, H≈0.5 = random walk. Computed via R/S analysis.</p>
      {result && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-panel border border-border rounded-lg p-6 min-w-48">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">HURST EXPONENT</div>
            <div className={`text-4xl font-data font-bold tabular-nums ${hurstCls}`}>{result.hurst.toFixed(4)}</div>
            <div className="text-text-2 text-xs mt-2">{result.interpretation}</div>
          </div>
          <div className="bg-panel border border-border rounded-lg p-4 flex-1 min-w-48">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">R/S VALUES BY LAG</div>
            <div className="flex flex-wrap gap-2">
              {result.lags.slice(0, 12).map((lag, i) => (
                <div key={lag} className="text-xs font-data">
                  <span className="text-text-3">{lag}d:</span> <span className="text-text-1">{result.rs_values[i]?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Statistical Tests ──────────────────────────────────────────────────────────
function StatTestsTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<StatTestsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getStatTests(instrumentId, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />
      {result && (
        <div className="grid gap-3 max-w-3xl">
          {/* ADF Test */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-text-2 text-[13px] font-semibold">ADF TEST</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.adf.is_stationary ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                {result.adf.interpretation}
              </span>
            </div>
            <div className="flex gap-6 text-[13px] font-data">
              <span className="text-text-3">Stat: <span className="text-text-1">{result.adf.statistic}</span></span>
              <span className="text-text-3">p-val: <span className={result.adf.pvalue < 0.05 ? "text-pos" : "text-neg"}>{result.adf.pvalue}</span></span>
              {Object.entries(result.adf.critical_values).map(([k, v]) => (
                <span key={k} className="text-text-3">{k}: <span className="text-text-2">{v}</span></span>
              ))}
            </div>
          </div>
          {/* Ljung-Box */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-text-2 text-[13px] font-semibold">LJUNG-BOX TEST (lag 10)</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.ljung_box.is_autocorrelated ? "bg-warn/20 text-warn" : "bg-pos/20 text-pos"}`}>
                {result.ljung_box.interpretation}
              </span>
            </div>
            <div className="flex gap-6 text-[13px] font-data">
              <span className="text-text-3">Stat: <span className="text-text-1">{result.ljung_box.statistic}</span></span>
              <span className="text-text-3">p-val: <span className={result.ljung_box.pvalue < 0.05 ? "text-neg" : "text-pos"}>{result.ljung_box.pvalue}</span></span>
            </div>
          </div>
          {/* Jarque-Bera */}
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-text-2 text-[13px] font-semibold">JARQUE-BERA NORMALITY</span>
              <span className={`text-xs px-2 py-0.5 rounded ${result.jarque_bera.is_normal ? "bg-pos/20 text-pos" : "bg-warn/20 text-warn"}`}>
                {result.jarque_bera.interpretation}
              </span>
            </div>
            <div className="flex gap-6 text-[13px] font-data">
              <span className="text-text-3">Stat: <span className="text-text-1">{result.jarque_bera.statistic}</span></span>
              <span className="text-text-3">p-val: <span className="text-text-1">{result.jarque_bera.pvalue}</span></span>
              <span className="text-text-3">Skew: <span className={Math.abs(result.jarque_bera.skewness) > 1 ? "text-warn" : "text-text-1"}>{result.jarque_bera.skewness}</span></span>
              <span className="text-text-3">ExKurt: <span className={Math.abs(result.jarque_bera.excess_kurtosis) > 3 ? "text-neg" : "text-text-1"}>{result.jarque_bera.excess_kurtosis}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kelly Criterion ────────────────────────────────────────────────────────────
function KellyTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<KellyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getKelly(instrumentId, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const cards = result ? [
    { label: "KELLY FULL", val: pct(result.kelly_full), cls: "text-accent" },
    { label: "KELLY 1/2 (safer)", val: pct(result.kelly_half), cls: "text-text-1" },
    { label: "KELLY 1/4 (conservative)", val: pct(result.kelly_quarter), cls: "text-text-2" },
    { label: "WIN RATE", val: pct(result.win_rate), cls: colCls(result.win_rate - 0.5) },
    { label: "AVG WIN", val: pct(result.avg_win, 3), cls: "text-pos" },
    { label: "AVG LOSS", val: pct(result.avg_loss, 3), cls: "text-neg" },
    { label: "WIN/LOSS RATIO", val: num(result.win_loss_ratio), cls: colCls(result.win_loss_ratio - 1) },
    { label: "EXPECTED VALUE", val: pct(result.expected_value, 4), cls: colCls(result.expected_value) },
  ] : [];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Kelly f* = p/a - q/b. Optimal fraction of capital to risk per trade to maximize geometric growth. Use 1/2 or 1/4 Kelly in practice.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
        {cards.map(c => (
          <div key={c.label} className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">{c.label}</div>
            <div className={`text-2xl font-data font-bold tabular-nums ${loading ? "text-text-3/30" : c.cls}`}>{loading ? "—" : c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── VWAP / TWAP ────────────────────────────────────────────────────────────────
function VWAPTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2026-06-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<VWAPResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getVWAP(instrumentId, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const cards = result ? [
    { label: "CURRENT PRICE", val: result.current_price.toFixed(4), cls: "text-text-1" },
    { label: "VWAP", val: result.vwap.toFixed(4), cls: "text-accent" },
    { label: "TWAP", val: result.twap.toFixed(4), cls: "text-info" },
    { label: "VWAP DEVIATION", val: (result.vwap_deviation_pct > 0 ? "+" : "") + result.vwap_deviation_pct.toFixed(2) + "%", cls: colCls(result.vwap_deviation_pct) },
    { label: "TWAP DEVIATION", val: (result.twap_deviation_pct > 0 ? "+" : "") + result.twap_deviation_pct.toFixed(2) + "%", cls: colCls(result.twap_deviation_pct) },
    { label: "TOTAL VOLUME", val: result.total_volume.toLocaleString(), cls: "text-text-2" },
  ] : [];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">VWAP = Volume-Weighted Average Price (typical price × volume / total volume). TWAP = simple time-weighted average. Deviation shows how current price compares.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
        {cards.map(c => (
          <div key={c.label} className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">{c.label}</div>
            <div className={`text-2xl font-data font-bold tabular-nums ${loading ? "text-text-3/30" : c.cls}`}>{loading ? "—" : c.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GBM Monte Carlo ────────────────────────────────────────────────────────────
function GBMTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [horizon, setHorizon] = useState(252);
  const [nSim, setNSim] = useState(1000);
  const [result, setResult] = useState<GBMResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getGBMMonteCarlo(instrumentId, start, end, horizon, nSim, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const cards = result ? [
    { label: "PROB. PROFIT", val: pct(result.prob_profit), cls: colCls(result.prob_profit - 0.5) },
    { label: "PROB. -20% LOSS", val: pct(result.prob_loss_20pct), cls: "text-neg" },
    { label: "MEDIAN RETURN", val: pct(result.terminal_median - 1), cls: colCls(result.terminal_median - 1) },
    { label: "P5 TERMINAL", val: pct(result.terminal_p5 - 1), cls: "text-neg" },
    { label: "P95 TERMINAL", val: pct(result.terminal_p95 - 1), cls: "text-pos" },
    { label: "ANN DRIFT μ", val: pct(result.mu_daily * 252), cls: colCls(result.mu_daily) },
    { label: "ANN VOL σ", val: pct(result.sigma_daily * Math.sqrt(252)), cls: "text-text-2" },
    { label: "ITÔ CORRECTION", val: pct(result.ito_drift_correction * 252, 4), cls: "text-text-3" },
  ] : [];

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <span className="text-accent text-[13px]">HORIZON</span>
        <select className="bg-panel border border-border text-text-1 text-[13px] px-2 py-1 rounded cursor-pointer" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
          {[63, 126, 252, 504].map(d => <option key={d} value={d}>{d}d</option>)}
        </select>
        <span className="text-accent text-[13px]">SIMS</span>
        <select className="bg-panel border border-border text-text-1 text-[13px] px-2 py-1 rounded cursor-pointer" value={nSim} onChange={e => setNSim(Number(e.target.value))}>
          {[500, 1000, 2000, 5000].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}
        </select>
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN GBM"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">GBM: dS = μS dt + σS dW. Via Itô&apos;s lemma: S(t) = S(0)·exp((μ - σ²/2)t + σW(t)). The σ²/2 term is the Itô drift correction.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mb-4">
        {cards.map(c => (
          <div key={c.label} className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">{c.label}</div>
            <div className={`text-xl font-data font-bold tabular-nums ${loading ? "text-text-3/30" : c.cls}`}>{loading ? "—" : c.val}</div>
          </div>
        ))}
      </div>
      {result && result.paths && (
        <div className="bg-panel border border-border rounded-lg p-4 max-w-3xl">
          <div className="text-text-3 text-[10px] uppercase tracking-wider mb-3">PERCENTILE PATHS (normalized to 1.0)</div>
          <div className="overflow-x-auto">
            <table className="text-[12px] font-data w-full">
              <thead>
                <tr className="text-text-3 text-[10px]">
                  <th className="text-left pr-4">DAY</th>
                  <th className="text-right pr-3 text-neg">P5</th>
                  <th className="text-right pr-3 text-text-2">P25</th>
                  <th className="text-right pr-3 text-text-1">P50</th>
                  <th className="text-right pr-3 text-text-2">P75</th>
                  <th className="text-right text-pos">P95</th>
                </tr>
              </thead>
              <tbody>
                {result.day_indices.filter((_, i) => i % 3 === 0 || i === result.day_indices.length - 1).map((d, i) => {
                  const idx = result.day_indices.indexOf(d);
                  return (
                    <tr key={d} className={i % 2 === 0 ? "bg-panel-2/50" : ""}>
                      <td className="pr-4 text-text-3">{d}</td>
                      <td className="text-right pr-3 text-neg">{result.paths.p5[idx]?.toFixed(3)}</td>
                      <td className="text-right pr-3 text-text-2">{result.paths.p25[idx]?.toFixed(3)}</td>
                      <td className="text-right pr-3 text-text-1">{result.paths.p50[idx]?.toFixed(3)}</td>
                      <td className="text-right pr-3 text-text-2">{result.paths.p75[idx]?.toFixed(3)}</td>
                      <td className="text-right text-pos">{result.paths.p95[idx]?.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HMM Regime Detection ───────────────────────────────────────────────────────
function HMMTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2023-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [nComp, setNComp] = useState(2);
  const [result, setResult] = useState<HMMRegimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getHMMRegime(instrumentId, start, end, nComp, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const regimeCls = (r: string) => r.includes("bull") ? "text-pos" : "text-neg";

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <span className="text-accent text-[13px]">STATES</span>
        <select className="bg-panel border border-border text-text-1 text-[13px] px-2 py-1 rounded cursor-pointer" value={nComp} onChange={e => setNComp(Number(e.target.value))}>
          <option value={2}>2 states</option><option value={3}>3 states</option>
        </select>
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "FITTING..." : "FIT HMM"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Hidden Markov Model detects latent market regimes (bull/bear) from return distributions. States are sorted by mean return.</p>
      {result && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-panel border border-border rounded-lg p-6 min-w-56">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-1">CURRENT REGIME</div>
            <div className={`text-xl font-bold uppercase ${regimeCls(result.current_regime)}`}>{result.current_regime.replace(/_/g, " ")}</div>
            <div className="mt-4 space-y-2">
              {Object.entries(result.regime_distribution).map(([r, p]) => (
                <div key={r} className="text-[13px]">
                  <span className="text-text-3">{r.replace(/_/g, " ")}: </span>
                  <span className={`font-data ${regimeCls(r)}`}>{pct(p)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">STATE PARAMETERS</div>
            <table className="text-[13px] font-data">
              <thead><tr className="text-text-3 text-[10px]"><th className="text-left pr-4">STATE</th><th className="text-right pr-4">MEAN (daily)</th><th className="text-right">VOL (daily)</th></tr></thead>
              <tbody>
                {result.state_means.map((m, i) => (
                  <tr key={i}><td className="pr-4 text-text-3">{i}</td><td className={`text-right pr-4 ${colCls(m)}`}>{pct(m, 4)}</td><td className="text-right text-text-2">{pct(result.state_vols[i], 4)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">TRANSITION MATRIX</div>
            <table className="text-[13px] font-data">
              <tbody>
                {result.transition_matrix.map((row, i) => (
                  <tr key={i}>{row.map((v, j) => <td key={j} className={`pr-4 ${i === j ? "text-accent" : "text-text-2"}`}>{v.toFixed(4)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pairs Trading ──────────────────────────────────────────────────────────────
function PairsTab() {
  const [instrA, setInstrA] = useState("AAPL.NASDAQ");
  const [instrB, setInstrB] = useState("MSFT.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<PairsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getPairsTrading(instrA, instrB, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">ASSET A</span><InstrumentSelect value={instrA} onChange={setInstrA} />
        <span className="text-accent text-[13px]">ASSET B</span><InstrumentSelect value={instrB} onChange={setInstrB} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "TESTING..." : "TEST COINTEGRATION"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Pairs trading: find cointegrated assets, trade mean-reversion of spread. Spread = A - hedge_ratio × B. Entry at |z-score| &gt; 2.</p>
      {result && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-panel border border-border rounded-lg p-4 min-w-64">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-text-2 text-[13px] font-semibold">COINTEGRATION</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${result.cointegrated ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                {result.cointegrated ? "COINTEGRATED" : "NOT COINTEGRATED"}
              </span>
            </div>
            <div className="space-y-1 text-[13px] font-data">
              <div><span className="text-text-3">EG p-val: </span><span className={result.eg_pvalue < 0.05 ? "text-pos" : "text-neg"}>{result.eg_pvalue}</span></div>
              <div><span className="text-text-3">Johansen: </span><span className={result.johansen_cointegrated ? "text-pos" : "text-neg"}>{result.johansen_trace_stat.toFixed(4)} ({result.johansen_cointegrated ? "coint" : "no coint"})</span></div>
              <div><span className="text-text-3">Hedge ratio: </span><span className="text-text-1">{result.hedge_ratio}</span></div>
              <div><span className="text-text-3">Half-life: </span><span className="text-accent">{result.half_life_days.toFixed(1)} days</span></div>
              <div><span className="text-text-3">Buy signals: </span><span className="text-pos">{result.n_buy_signals}</span></div>
              <div><span className="text-text-3">Sell signals: </span><span className="text-neg">{result.n_sell_signals}</span></div>
            </div>
          </div>
          {result.zscore.length > 0 && (
            <div className="bg-panel border border-border rounded-lg p-4 flex-1 min-w-64">
              <div className="text-text-3 text-[10px] uppercase tracking-wider mb-2">Z-SCORE (last 30)</div>
              <div className="flex gap-1 flex-wrap">
                {result.zscore.slice(-30).map((z, i) => (
                  <span key={i} className={`text-xs font-data ${Math.abs(z) > 2 ? (z > 0 ? "text-neg font-bold" : "text-pos font-bold") : "text-text-3"}`}>
                    {z.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stress Testing ─────────────────────────────────────────────────────────────
function StressTestTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [beta, setBeta] = useState(1.0);
  const [result, setResult] = useState<StressTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getStressTest(instrumentId, start, end, beta, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <span className="text-accent text-[13px]">BETA</span>
        <input type="number" step="0.1" min="0" max="5" value={beta} onChange={e => setBeta(Number(e.target.value))} className="w-16 bg-panel border border-border text-text-1 text-[13px] px-2 py-1 rounded" />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN STRESS TEST"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Historical stress scenarios. Portfolio impact = beta × market_return. Stressed VaR = current VaR × vol_spike_factor.</p>
      {result && (
        <div>
          <div className="flex gap-3 mb-4 text-[13px] font-data">
            <span className="text-text-3">Ann.Vol: <span className="text-text-1">{pct(result.current_vol_ann)}</span></span>
            <span className="text-text-3">Daily VaR95: <span className="text-neg">{pct(result.current_var95_daily, 3)}</span></span>
            <span className="text-text-3">Beta used: <span className="text-accent">{result.beta_used}</span></span>
          </div>
          <div className="overflow-x-auto">
            <table className="text-[13px] w-full max-w-4xl">
              <thead>
                <tr className="text-text-3 text-[11px] border-b border-border">
                  <th className="text-left pb-2 pr-4">SCENARIO</th>
                  <th className="text-left pb-2 pr-4 text-text-3/70">PERIOD</th>
                  <th className="text-right pb-2 pr-4">MKT RETURN</th>
                  <th className="text-right pb-2 pr-4">PORTFOLIO IMPACT</th>
                  <th className="text-right pb-2 pr-4">STRESSED VaR</th>
                  <th className="text-right pb-2">VOL SPIKE</th>
                </tr>
              </thead>
              <tbody>
                {result.scenarios.map((s, i) => (
                  <tr key={s.name} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-panel/30"}`}>
                    <td className="py-2 pr-4 text-text-1 font-semibold">{s.name}</td>
                    <td className="py-2 pr-4 text-text-3 text-[11px]">{s.period}</td>
                    <td className="py-2 pr-4 text-right font-data text-neg">{pct(s.market_return)}</td>
                    <td className="py-2 pr-4 text-right font-data text-neg font-bold">{pct(s.portfolio_impact)}</td>
                    <td className="py-2 pr-4 text-right font-data text-neg">{pct(s.var_stressed, 3)}</td>
                    <td className="py-2 text-right font-data text-warn">{s.vol_spike_factor}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk Parity ────────────────────────────────────────────────────────────────
function RiskParityTab() {
  const [instruments, setInstruments] = useState(["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX"]);
  const [newInstr, setNewInstr] = useState("");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<RiskParityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getRiskParity(instruments, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3 flex-wrap">
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "OPTIMIZING..." : "RUN RISK PARITY"}</button>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap items-center">
        {instruments.map(i => (
          <span key={i} className="bg-panel border border-border text-text-2 text-[12px] px-2 py-0.5 rounded flex items-center gap-1">
            {i}
            <button className="text-text-3 hover:text-neg border-0 bg-transparent cursor-pointer p-0 ml-1" onClick={() => setInstruments(instruments.filter(x => x !== i))}>✕</button>
          </span>
        ))}
        <input placeholder="Add symbol..." value={newInstr} onChange={e => setNewInstr(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && newInstr.trim()) { setInstruments([...instruments, newInstr.trim()]); setNewInstr(""); }}}
          className="bg-panel border border-border text-text-1 text-[13px] px-2 py-0.5 rounded w-32" />
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Risk Parity: each asset contributes equally to total portfolio risk. Solves: min Σ(RC_i - target)² subject to Σw_i=1, w_i≥0.</p>
      {result && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-panel border border-border rounded-lg p-4">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-3">ALLOCATION & RISK CONTRIBUTION</div>
            <table className="text-[13px] font-data">
              <thead><tr className="text-text-3 text-[10px]"><th className="text-left pr-6">ASSET</th><th className="text-right pr-6">WEIGHT</th><th className="text-right">RISK CONTRIB</th></tr></thead>
              <tbody>
                {Object.entries(result.weights).map(([k, w]) => (
                  <tr key={k}>
                    <td className="pr-6 text-text-1">{k}</td>
                    <td className="text-right pr-6 text-accent">{pct(w)}</td>
                    <td className="text-right text-text-2">{pct(result.risk_contribution[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-panel border border-border rounded-lg p-4 min-w-48">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-3">PORTFOLIO STATS</div>
            <div className="space-y-2 text-[13px] font-data">
              <div><span className="text-text-3">Expected Return: </span><span className={colCls(result.expected_return)}>{pct(result.expected_return)}</span></div>
              <div><span className="text-text-3">Expected Vol: </span><span className="text-text-2">{pct(result.expected_vol)}</span></div>
              <div><span className="text-text-3">Sharpe: </span><span className={colCls(result.sharpe)}>{num(result.sharpe)}</span></div>
              <div><span className="text-text-3">Converged: </span><span className={result.converged ? "text-pos" : "text-neg"}>{result.converged ? "YES" : "NO"}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Black-Litterman ────────────────────────────────────────────────────────────
function BlackLittermanTab() {
  const [instruments, setInstruments] = useState(["AAPL.NASDAQ", "MSFT.NASDAQ", "005930.XKRX"]);
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [views, setViews] = useState<BLView[]>([{ instrument: "AAPL.NASDAQ", expected_return: 0.15, confidence: 0.7 }]);
  const [result, setResult] = useState<BlackLittermanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getBlackLitterman(instruments, start, end, views, 0.05, 2.5, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  function updateView(i: number, field: keyof BLView, val: string | number) {
    setViews(views.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-3 flex-wrap">
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "OPTIMIZING..." : "RUN BL"}</button>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {instruments.map(i => (
          <span key={i} className="bg-panel border border-border text-text-2 text-[12px] px-2 py-0.5 rounded">{i}</span>
        ))}
      </div>
      <div className="mb-3">
        <div className="text-text-3 text-[11px] uppercase tracking-wider mb-1">INVESTOR VIEWS</div>
        {views.map((v, i) => (
          <div key={i} className="flex gap-2 items-center mb-1.5">
            <select className="bg-panel border border-border text-text-1 text-[13px] px-2 py-0.5 rounded cursor-pointer" value={v.instrument} onChange={e => updateView(i, "instrument", e.target.value)}>
              {instruments.map(inst => <option key={inst} value={inst}>{inst}</option>)}
            </select>
            <span className="text-text-3 text-[12px]">exp.return</span>
            <input type="number" step="0.01" value={v.expected_return} onChange={e => updateView(i, "expected_return", parseFloat(e.target.value))} className="w-16 bg-panel border border-border text-text-1 text-[13px] px-2 py-0.5 rounded" />
            <span className="text-text-3 text-[12px]">confidence</span>
            <input type="number" step="0.1" min="0.1" max="0.99" value={v.confidence} onChange={e => updateView(i, "confidence", parseFloat(e.target.value))} className="w-16 bg-panel border border-border text-text-1 text-[13px] px-2 py-0.5 rounded" />
            <button className="text-neg text-[13px] border-0 bg-transparent cursor-pointer" onClick={() => setViews(views.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button className="text-accent text-[12px] border-0 bg-transparent cursor-pointer" onClick={() => setViews([...views, { instrument: instruments[0] ?? "", expected_return: 0.10, confidence: 0.5 }])}>+ Add View</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Black-Litterman combines equilibrium returns (CAPM prior) with investor views. Posterior μ_BL = [(τΣ)⁻¹ + PᵀΩ⁻¹P]⁻¹[(τΣ)⁻¹π + PᵀΩ⁻¹Q].</p>
      {result && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-panel border border-border rounded-lg p-4 min-w-64">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-3">OPTIMAL WEIGHTS</div>
            <table className="text-[13px] font-data">
              <tbody>
                {Object.entries(result.weights).map(([k, w]) => (
                  <tr key={k}><td className="pr-6 text-text-1">{k}</td><td className="text-right text-accent">{pct(w)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-border space-y-1 text-[13px] font-data">
              <div><span className="text-text-3">Expected Return: </span><span className={colCls(result.expected_return)}>{pct(result.expected_return)}</span></div>
              <div><span className="text-text-3">Expected Vol: </span><span className="text-text-2">{pct(result.expected_vol)}</span></div>
              <div><span className="text-text-3">Sharpe: </span><span className={colCls(result.sharpe)}>{num(result.sharpe)}</span></div>
            </div>
          </div>
          {result.posterior_returns && (
            <div className="bg-panel border border-border rounded-lg p-4">
              <div className="text-text-3 text-[10px] uppercase tracking-wider mb-3">RETURNS: PRIOR → POSTERIOR</div>
              <table className="text-[13px] font-data">
                <thead><tr className="text-text-3 text-[10px]"><th className="text-left pr-4">ASSET</th><th className="text-right pr-4">PRIOR</th><th className="text-right">POSTERIOR</th></tr></thead>
                <tbody>
                  {Object.keys(result.weights).map(k => (
                    <tr key={k}>
                      <td className="pr-4 text-text-1">{k}</td>
                      <td className="text-right pr-4 text-text-3">{pct(result.prior_returns?.[k])}</td>
                      <td className={`text-right ${colCls(result.posterior_returns?.[k])}`}>{pct(result.posterior_returns?.[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fama-French Factor Attribution ────────────────────────────────────────────
function FamaFrenchTab() {
  const [instrumentId, setInstrumentId] = useState("AAPL.NASDAQ");
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2026-06-23");
  const [result, setResult] = useState<FactorAttributionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setLoading(true); setError(null);
    try { setResult(await getFactorAttribution(instrumentId, start, end, ctrl.signal)); }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const sigCls = (pv: number | null) => pv != null && pv < 0.05 ? "text-pos" : "text-text-3";

  return (
    <div>
      <div className="flex gap-3 items-center mb-3.5 flex-wrap">
        <span className="text-accent text-[13px]">SYMBOL</span><InstrumentSelect value={instrumentId} onChange={setInstrumentId} />
        <span className="text-accent text-[13px]">DATE</span>
        <DateRangePicker start={start} end={end} onStartChange={setStart} onEndChange={setEnd} />
        <button className="px-5 py-1.5 text-[13px] font-bold bg-accent text-black rounded cursor-pointer hover:brightness-110 border-0" onClick={run}>{loading ? "COMPUTING..." : "RUN FF3"}</button>
      </div>
      <Err msg={error} />
      <p className="text-text-3 text-xs mb-3">Fama-French 3-factor: R-Rf = α + β_mkt(Mkt-Rf) + β_smb·SMB + β_hml·HML + ε. Downloads daily FF3 data from CRSP library.</p>
      {result?.error && <p className="text-warn text-[13px] mb-3">Note: {result.error}</p>}
      {result && !result.error && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-panel border border-border rounded-lg p-4 min-w-72">
            <div className="text-text-3 text-[10px] uppercase tracking-wider mb-3">FACTOR LOADINGS</div>
            <table className="text-[13px] font-data w-full">
              <thead><tr className="text-text-3 text-[10px]"><th className="text-left pr-4">FACTOR</th><th className="text-right pr-4">BETA</th><th className="text-right">p-value</th></tr></thead>
              <tbody>
                <tr><td className="pr-4 text-accent">Alpha (Ann.)</td><td className={`text-right pr-4 ${colCls(result.alpha)}`}>{result.alpha != null ? pct(result.alpha) : "N/A"}</td><td className={`text-right ${sigCls(result.alpha_pvalue)}`}>{result.alpha_pvalue?.toFixed(4) ?? "—"}</td></tr>
                <tr><td className="pr-4 text-text-1">Market (MKT-RF)</td><td className={`text-right pr-4 ${colCls(result.mkt_rf)}`}>{num(result.mkt_rf)}</td><td className={`text-right ${sigCls(result.mkt_rf_pvalue)}`}>{result.mkt_rf_pvalue?.toFixed(4) ?? "—"}</td></tr>
                <tr><td className="pr-4 text-text-1">Size (SMB)</td><td className={`text-right pr-4 ${colCls(result.smb)}`}>{num(result.smb)}</td><td className={`text-right ${sigCls(result.smb_pvalue)}`}>{result.smb_pvalue?.toFixed(4) ?? "—"}</td></tr>
                <tr><td className="pr-4 text-text-1">Value (HML)</td><td className={`text-right pr-4 ${colCls(result.hml)}`}>{num(result.hml)}</td><td className={`text-right ${sigCls(result.hml_pvalue)}`}>{result.hml_pvalue?.toFixed(4) ?? "—"}</td></tr>
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-border text-[13px] font-data">
              <span className="text-text-3">R²: </span><span className="text-text-1">{result.r_squared?.toFixed(4) ?? "—"}</span>
              <span className="text-text-3 ml-4">Obs: </span><span className="text-text-2">{result.obs ?? "—"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
// ── Macro Panel Wrappers ──────────────────────────────────────────────────────
function SubTabs({ items, active, onChange }: {
  items: { id: string; label: string; desc?: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 mb-5 border-b border-border">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          title={item.desc}
          className={`px-5 py-1.5 text-[13px] cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
            active === item.id
              ? "border-accent text-accent font-bold"
              : "border-transparent text-text-3 font-normal hover:text-text-1"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MacroUSPanel() {
  const [sub, setSub] = useState<"fred" | "edgar">("fred");
  const items = [
    { id: "fred",  label: "FRED DATA",  desc: "세인트루이스 연준 — 금리·환율·실업률 등 미국 거시 지표" },
    { id: "edgar", label: "SEC EDGAR",  desc: "미국 기업 XBRL 재무제표 (무료)" },
  ];
  return (
    <div>
      <SubTabs items={items} active={sub} onChange={id => setSub(id as "fred" | "edgar")} />
      {sub === "fred"  && <FREDPanel />}
      {sub === "edgar" && <EdgarPanel />}
    </div>
  );
}

function MacroKRPanel() {
  const [sub, setSub] = useState<"ecos" | "ksd">("ecos");
  const items = [
    { id: "ecos", label: "ECOS DATA",  desc: "한국은행 — 금리·환율·CPI 등 한국 거시 지표" },
    { id: "ksd",  label: "KSD DATA",   desc: "한국예탁결제원 — 배당·대차·권리일정" },
  ];
  return (
    <div>
      <SubTabs items={items} active={sub} onChange={id => setSub(id as "ecos" | "ksd")} />
      {sub === "ecos" && <ECOSPanel />}
      {sub === "ksd"  && <KSDPanel />}
    </div>
  );
}

const SIDEBAR = [
  { id: "risk" as Category,        label: "리스크",    desc: "Risk · CVaR · Stress" },
  { id: "simulation" as Category,  label: "시뮬레이션", desc: "Monte Carlo · GBM" },
  { id: "portfolio" as Category,   label: "포트폴리오", desc: "Markowitz · Parity · BL" },
  { id: "regime" as Category,      label: "레짐",      desc: "SMA · HMM" },
  { id: "statistics" as Category,  label: "통계검정",  desc: "ADF · Hurst · Kelly · Pairs" },
  { id: "macro" as Category,       label: "매크로",    desc: "FRED · ECOS · KSD" },
];

const RISK_SUBS:  { id: RiskSub;   label: string }[] = [
  { id: "metrics", label: "지표" },
  { id: "beta",    label: "베타/팩터" },
  { id: "cvar",    label: "CVaR" },
  { id: "stress",  label: "스트레스" },
];
const SIM_SUBS:   { id: SimSub;    label: string }[] = [
  { id: "bootstrap", label: "부트스트랩 MC" },
  { id: "gbm",       label: "GBM (Itô)" },
];
const PORT_SUBS:  { id: PortSub;   label: string }[] = [
  { id: "correlation", label: "상관관계" },
  { id: "markowitz",   label: "마코위츠" },
  { id: "riskparity",  label: "리스크패리티" },
  { id: "bl",          label: "블랙-리터만" },
];
const REGIME_SUBS: { id: RegimeSub; label: string }[] = [
  { id: "rule", label: "규칙기반" },
  { id: "hmm",  label: "HMM" },
];
const STAT_SUBS:  { id: StatSub;   label: string }[] = [
  { id: "stattests", label: "통계검정" },
  { id: "hurst",     label: "허스트" },
  { id: "ff3",       label: "파마-프렌치" },
  { id: "kelly",     label: "켈리" },
  { id: "pairs",     label: "페어스" },
  { id: "vwap",      label: "VWAP/TWAP" },
];
const MACRO_SUBS: { id: MacroSub;  label: string }[] = [
  { id: "us", label: "US (FRED)" },
  { id: "kr", label: "KR (ECOS/KSD)" },
];

function SubTabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-0 border-b border-border mb-4 shrink-0">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-[13px] cursor-pointer border-0 border-b-2 -mb-px bg-transparent transition-colors ${
            active === t.id
              ? "border-accent text-accent font-medium"
              : "border-transparent text-text-3 hover:text-text-1"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function QuantPage() {
  const [category, setCategory] = useState<Category>("risk");
  const [riskSub,  setRiskSub]  = useState<RiskSub>("metrics");
  const [simSub,   setSimSub]   = useState<SimSub>("bootstrap");
  const [portSub,  setPortSub]  = useState<PortSub>("correlation");
  const [regSub,   setRegSub]   = useState<RegimeSub>("rule");
  const [statSub,  setStatSub]  = useState<StatSub>("stattests");
  const [macroSub, setMacroSub] = useState<MacroSub>("us");

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-44 shrink-0 border-r border-border bg-panel flex flex-col">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <span className="text-text-3 text-[10px] uppercase tracking-widest font-semibold">Quant Lab</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-1">
          {SIDEBAR.map(item => (
            <button
              key={item.id}
              onClick={() => setCategory(item.id)}
              className={`w-full text-left px-4 py-3 border-0 cursor-pointer transition-colors border-l-2 ${
                category === item.id
                  ? "border-l-accent bg-accent/10 text-text-1"
                  : "border-l-transparent bg-transparent text-text-3 hover:text-text-1 hover:bg-panel-2"
              }`}
            >
              <div className={`text-[13px] font-medium ${category === item.id ? "text-accent" : ""}`}>
                {item.label}
              </div>
              <div className="text-[10px] text-text-3 mt-0.5 leading-tight">{item.desc}</div>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          {category === "risk" && (
            <>
              <SubTabBar tabs={RISK_SUBS} active={riskSub} onChange={setRiskSub} />
              {riskSub === "metrics" && <RiskTab />}
              {riskSub === "beta"    && <FactorTab />}
              {riskSub === "cvar"    && <CVaRTab />}
              {riskSub === "stress"  && <StressTestTab />}
            </>
          )}
          {category === "simulation" && (
            <>
              <SubTabBar tabs={SIM_SUBS} active={simSub} onChange={setSimSub} />
              {simSub === "bootstrap" && <MonteCarloTab />}
              {simSub === "gbm"       && <GBMTab />}
            </>
          )}
          {category === "portfolio" && (
            <>
              <SubTabBar tabs={PORT_SUBS} active={portSub} onChange={setPortSub} />
              {portSub === "correlation" && <CorrelationTab />}
              {portSub === "markowitz"   && <PortfolioTab />}
              {portSub === "riskparity"  && <RiskParityTab />}
              {portSub === "bl"          && <BlackLittermanTab />}
            </>
          )}
          {category === "regime" && (
            <>
              <SubTabBar tabs={REGIME_SUBS} active={regSub} onChange={setRegSub} />
              {regSub === "rule" && <RegimeTab />}
              {regSub === "hmm"  && <HMMTab />}
            </>
          )}
          {category === "statistics" && (
            <>
              <SubTabBar tabs={STAT_SUBS} active={statSub} onChange={setStatSub} />
              {statSub === "stattests" && <StatTestsTab />}
              {statSub === "hurst"     && <HurstTab />}
              {statSub === "ff3"       && <FamaFrenchTab />}
              {statSub === "kelly"     && <KellyTab />}
              {statSub === "pairs"     && <PairsTab />}
              {statSub === "vwap"      && <VWAPTab />}
            </>
          )}
          {category === "macro" && (
            <>
              <SubTabBar tabs={MACRO_SUBS} active={macroSub} onChange={setMacroSub} />
              {macroSub === "us" && <MacroUSPanel />}
              {macroSub === "kr" && <MacroKRPanel />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
