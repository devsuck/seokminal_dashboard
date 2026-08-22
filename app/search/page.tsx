"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createChart, CandlestickSeries, UTCTimestamp } from "lightweight-charts";
import {
  searchKR, searchUS, getKRBars, getIBBars,
  KRSearchResult, USSearchResult, KRBar, KISTick,
  ApiError, runScreener, type ScreenerResult,
  getKRXStockBase, type KRXStockBaseRow,
} from "@/lib/api";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button, SegmentedToggle } from "@/components/ui";
import { TOKEN } from "@/lib/chart-colors";
import { addToWatchlist, getWatchlist } from "@/lib/watchlist-storage";

// ── Search constants ──────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const DURATIONS = [30, 90, 180, 365, 730] as const;
type Duration = (typeof DURATIONS)[number];

type Market = "KR" | "US";
type AnyResult = { label: string; sub: string; code: string };

function toAnyResult(r: KRSearchResult): AnyResult {
  return { label: r.name, sub: r.code + " · " + r.market, code: r.code };
}
function usAnyResult(r: USSearchResult): AnyResult {
  return { label: r.symbol, sub: (r.name || r.sec_type) + " · " + r.exchange, code: r.symbol };
}

function krDateToTs(date: string): UTCTimestamp {
  return Math.floor(
    new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`).getTime() / 1000,
  ) as UTCTimestamp;
}

type ChartBar = { time: UTCTimestamp; open: number; high: number; low: number; close: number };

function CandleChart({ bars }: { bars: ChartBar[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: { background: { color: "transparent" }, textColor: TOKEN.text2 },
      grid: { vertLines: { color: TOKEN.border }, horzLines: { color: TOKEN.border } },
      timeScale: { borderColor: TOKEN.border },
      rightPriceScale: { borderColor: TOKEN.border },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: TOKEN.pos,
      downColor: TOKEN.neg,
      borderUpColor: TOKEN.pos,
      borderDownColor: TOKEN.neg,
      wickUpColor: TOKEN.pos,
      wickDownColor: TOKEN.neg,
    });
    series.setData(bars);
    chart.timeScale().fitContent();
    return () => { chart.remove(); };
  }, [bars]);

  return (
    <div ref={containerRef} style={{ height: "320px" }} className="w-full" />
  );
}

// ── Screener constants ────────────────────────────────────────────────────────
const EMA_SIGNAL_OPTS = [
  { value: "", label: "전체" },
  { value: "bullish_cross", label: "골든크로스 (EMA12↑EMA26)" },
  { value: "bearish_cross", label: "데드크로스 (EMA12↓EMA26)" },
  { value: "above", label: "EMA12 > EMA26" },
  { value: "below", label: "EMA12 < EMA26" },
];

const EMA_BADGE: Record<string, { label: string; cls: string }> = {
  bullish_cross: { label: "골든크로스", cls: "text-pos bg-pos/15 border-pos/25" },
  bearish_cross: { label: "데드크로스", cls: "text-neg bg-neg/15 border-neg/25" },
  above:         { label: "EMA↑",       cls: "text-pos bg-pos/10 border-pos/20" },
  below:         { label: "EMA↓",       cls: "text-neg bg-neg/10 border-neg/20" },
  neutral:       { label: "중립",        cls: "text-text-3 bg-panel-2 border-border" },
};

const PRESET_UNIVERSES = [
  { label: "미국 대형주", value: "AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,BRK.B,JPM,JNJ" },
  { label: "한국 대형주", value: "005930.KRX,000660.KRX,035420.KRX,005380.KRX,051910.KRX" },
  { label: "ETF", value: "SPY,QQQ,IWM,GLD,TLT,VNQ" },
];

function formatMktcap(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}T`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}B`;
  return `${v.toFixed(0)}M`;
}

// ── Tab types ─────────────────────────────────────────────────────────────────
type Tab = "탐색" | "전체목록" | "스크리너";
const TABS: Tab[] = ["탐색", "전체목록", "스크리너"];
type KrxMarket = "KOSPI" | "KOSDAQ";

// ── Combined page ─────────────────────────────────────────────────────────────
export default function SearchPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("탐색");

  // ── 탐색 state ──────────────────────────────────────────────────────────────
  const [market, setMarket] = useState<Market>("KR");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnyResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [days, setDays] = useState<Duration>(365);
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [loadingBars, setLoadingBars] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [liveTick, setLiveTick] = useState<KISTick | null>(null);
  const [wsStatus, setWsStatus] = useState<"off" | "connecting" | "live">("off");

  const searchAbortRef = useRef<AbortController | null>(null);
  const barsAbortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── 전체목록(구 유니버스빌더) state ─────────────────────────────────────────
  const [uMarket, setUMarket] = useState<KrxMarket>("KOSPI");
  const [uRows, setURows] = useState<KRXStockBaseRow[]>([]);
  const [uLoading, setULoading] = useState(false);
  const [uError, setUError] = useState<string | null>(null);
  const [uSearch, setUSearch] = useState("");
  const [uMaxCap, setUMaxCap] = useState<number>(0);
  const [uMktcapMax, setUMktcapMax] = useState<number>(10_000_000);
  const [uWatchlist, setUWatchlist] = useState<string[]>([]);
  const [uAddedSet, setUAddedSet] = useState<Set<string>>(new Set());
  const uAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { setUWatchlist(getWatchlist()); }, []);
  useEffect(() => () => { uAbortRef.current?.abort(); }, []);

  const loadUniverse = useCallback(async () => {
    uAbortRef.current?.abort();
    const ctrl = new AbortController();
    uAbortRef.current = ctrl;
    setULoading(true);
    setUError(null);
    setURows([]);
    setUMaxCap(0);
    try {
      const res = await getKRXStockBase(uMarket, ctrl.signal);
      const validRows = res.rows.filter(r => r.isu_cd && r.isu_nm);
      setURows(validRows);
      const caps = validRows.map(r => r.mktcap ?? 0).filter(v => v > 0);
      if (caps.length > 0) {
        const ceiling = Math.max(...caps);
        setUMktcapMax(ceiling);
        setUMaxCap(ceiling);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setUError(e instanceof ApiError ? e.message : "유니버스를 불러오지 못했습니다");
    } finally {
      if (!ctrl.signal.aborted) setULoading(false);
    }
  }, [uMarket]);

  const uFiltered = useMemo(() => {
    let out = uRows;
    if (uSearch.trim()) {
      const q = uSearch.trim().toLowerCase();
      out = out.filter(r =>
        (r.isu_nm ?? "").toLowerCase().includes(q) ||
        (r.isu_cd ?? "").toLowerCase().includes(q)
      );
    }
    if (uMaxCap > 0 && uMaxCap < uMktcapMax) {
      out = out.filter(r => (r.mktcap ?? 0) <= uMaxCap);
    }
    return out;
  }, [uRows, uSearch, uMaxCap, uMktcapMax]);

  const uInWatchlist = useMemo(() => {
    const wSet = new Set(uWatchlist);
    return (isu_cd: string) => wSet.has(`${isu_cd}.XKRX`) || uAddedSet.has(isu_cd);
  }, [uWatchlist, uAddedSet]);

  function uHandleAddWatchlist(isu_cd: string) {
    addToWatchlist(`${isu_cd}.XKRX`);
    setUAddedSet(prev => new Set(prev).add(isu_cd));
  }

  // ── 스크리너 state ──────────────────────────────────────────────────────────
  const [instruments, setInstruments] = useState("");
  const [rsiMin, setRsiMin] = useState("");
  const [rsiMax, setRsiMax] = useState("");
  const [emaSignal, setEmaSignal] = useState("");
  const [screenerDays, setScreenerDays] = useState(60);
  const [screenerResults, setScreenerResults] = useState<ScreenerResult[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState<string | null>(null);
  const screenerCtrlRef = useRef<AbortController | null>(null);

  // ── 탐색 effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowResults(false); return; }
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      try {
        if (market === "KR") {
          const res = await searchKR(query, ctrl.signal);
          if (searchAbortRef.current !== ctrl) return;
          setResults(res.results.map(toAnyResult));
        } else {
          const res = await searchUS(query, ctrl.signal);
          if (searchAbortRef.current !== ctrl) return;
          setResults(res.results.map(usAnyResult));
        }
        setShowResults(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, market]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    barsAbortRef.current?.abort();
    wsRef.current?.close();
    screenerCtrlRef.current?.abort();
  }, []);

  function connectWS(code: string) {
    wsRef.current?.close();
    setLiveTick(null);
    setWsStatus("connecting");
    const ws = new WebSocket(`${WS_BASE}/ws/live/${code}`);
    wsRef.current = ws;
    ws.onopen = () => { if (wsRef.current === ws) setWsStatus("live"); };
    ws.onclose = () => { if (wsRef.current === ws) setWsStatus("off"); };
    ws.onerror = () => { if (wsRef.current === ws) setWsStatus("off"); };
    ws.onmessage = (evt) => {
      try {
        const tick = JSON.parse(evt.data) as KISTick;
        if (!tick.error) setLiveTick(tick);
      } catch { /* ignore */ }
    };
  }

  async function loadBars(code: string, name: string) {
    setSelected({ code, name });
    setShowResults(false);
    setSearchError(null);
    setBars([]);

    barsAbortRef.current?.abort();
    const ctrl = new AbortController();
    barsAbortRef.current = ctrl;
    setLoadingBars(true);

    try {
      if (market === "KR") {
        const res = await getKRBars(code, days, ctrl.signal);
        if (barsAbortRef.current !== ctrl) return;
        setBars(res.bars.map((b: KRBar) => ({
          time: krDateToTs(b.date),
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })));
        connectWS(code);
      } else {
        const ibDuration = days > 365 ? `${Math.round(days / 365)} Y` : `${days} D`;
        const res = await getIBBars(
          { symbol: code, asset_type: "stock", duration: ibDuration },
          ctrl.signal,
        );
        if (barsAbortRef.current !== ctrl) return;
        setBars(res.bars.map(b => ({
          time: Math.floor(b.ts_ms / 1000) as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (barsAbortRef.current === ctrl) setSearchError(e instanceof Error ? e.message : "차트 데이터를 불러오지 못했습니다");
    } finally {
      if (barsAbortRef.current === ctrl) setLoadingBars(false);
    }
  }

  const changeCls = liveTick
    ? liveTick.change > 0 ? "bg-pos/20 text-pos" : liveTick.change < 0 ? "bg-neg/20 text-neg" : "text-text-3": "text-text-3";

  // ── 스크리너 handlers ───────────────────────────────────────────────────────
  async function handleRun() {
    const ids = instruments.trim();
    if (!ids) return;
    screenerCtrlRef.current?.abort();
    const ctrl = new AbortController();
    screenerCtrlRef.current = ctrl;
    setScreenerLoading(true); setScreenerError(null); setScreenerResults([]);
    try {
      const res = await runScreener({
        instruments: ids,
        rsi_min: rsiMin ? Number(rsiMin) : undefined,
        rsi_max: rsiMax ? Number(rsiMax) : undefined,
        ema_signal: emaSignal || undefined,
        days: screenerDays,
      }, ctrl.signal);
      if (!ctrl.signal.aborted) setScreenerResults(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!ctrl.signal.aborted)
        setScreenerError(e instanceof ApiError ? e.message : "스크리너 실패");
    } finally {
      if (!ctrl.signal.aborted) setScreenerLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-panel px-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? "border-b-2 border-accent text-accent bg-transparent px-4 py-2 text-sm": "text-text-3 hover:text-text-1 px-4 py-2 text-sm"}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "탐색" && (
          <div className="p-6 space-y-5 max-w-[900px]">
            {/* Market toggle + search bar */}
            <div className="flex gap-2">
              <div className="flex border border-border rounded-lg overflow-hidden">
                {(["KR", "US"] as Market[]).map(m => (
                  <button
                    key={m}
                    onClick={() => { setMarket(m); setQuery(""); setResults([]); setSelected(null); setBars([]); setLiveTick(null); wsRef.current?.close(); }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${market === m ? "bg-accent/10 text-accent border-accent" : "text-text-2 hover:text-text-1"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <input
                  type="text"value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => results.length && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 150)}
                  placeholder={market === "KR" ? "종목명 또는 코드 (예: 삼성전자, 005930)" : "종목 심볼 또는 이름 (예: AAPL, Apple)"}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-panel border border-border text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"/>
                {showResults && results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-panel border border-border rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    {results.map(r => (
                      <button
                        key={r.code}
                        onMouseDown={() => loadBars(r.code, r.label)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-panel-2 text-left">
                        <span className="text-text-1 font-medium">{r.label}</span>
                        <span className="text-text-3 text-xs">{r.sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={days}
                onChange={e => setDays(Number(e.target.value) as Duration)}
                className="px-3 py-2 text-sm rounded-lg bg-panel border border-border text-text-1 focus:outline-none focus:border-accent">
                {DURATIONS.map(d => (
                  <option key={d} value={d}>{d}D</option>
                ))}
              </select>
            </div>

            {/* Selected header + live ticker */}
            {selected && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-text-1 font-semibold">{selected.name}</span>
                  <span className="text-text-3 text-sm ml-2">{selected.code}</span>
                </div>
                <div className="flex items-center gap-3">
                  {liveTick && (
                    <>
                      <span className="text-text-1 font-data text-lg">{liveTick.price.toLocaleString()}</span>
                      <span className={`text-sm font-data px-1 font-bold ${changeCls}`}>
                        {liveTick.change > 0 ? "+" : ""}{liveTick.change.toLocaleString()} ({liveTick.change_rate.toFixed(2)}%)
                      </span>
                      <span className="text-text-3 text-xs">거래량 {liveTick.trade_volume.toLocaleString()}</span>
                    </>
                  )}
                  <button
                    onClick={() => router.push(`/market?symbol=${encodeURIComponent(selected.code)}`)}
                    className="px-3 h-6 text-xs rounded border border-border text-text-2 hover:border-accent hover:text-accent bg-transparent cursor-pointer transition-colors">
                    시장 차트 →
                  </button>
                  {market === "KR" && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${wsStatus === "live" ? "border-pos/40 text-pos bg-pos/5" : wsStatus === "connecting" ? "border-warn/40 text-warn bg-warn/5" : "border-border text-text-3"}`}>
                      {wsStatus === "live" ? "실시간" : wsStatus === "connecting" ? "연결 중" : "오프라인"}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Chart area */}
            <Panel>
              <PanelHeader>차트</PanelHeader>
              {loadingBars && (
                <div className="flex items-center justify-center h-[320px] text-text-3 text-sm">차트 불러오는 중…</div>
              )}
              {searchError && !loadingBars && (
                <div className="flex items-center justify-center h-[320px] text-neg text-sm">{searchError}</div>
              )}
              {!loadingBars && !searchError && bars.length > 0 && (
                <CandleChart bars={bars} />
              )}
              {!loadingBars && !searchError && bars.length === 0 && !selected && (
                <div className="flex items-center justify-center h-[320px] text-text-3 text-sm">
                  위에서 종목을 검색하면 차트가 표시됩니다
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "전체목록" && (
          <div className="p-6 space-y-4 max-w-[1200px]">
            <p className="text-text-3 text-xs">KRX 상장 전체 종목을 시가총액으로 필터링 · 관심종목 추가/백테스트 연결</p>

            <div className="bg-panel border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <label className="text-text-3 text-[11px] uppercase tracking-wider">시장</label>
                  <SegmentedToggle
                    value={uMarket}
                    onChange={setUMarket}
                    size="md"
                    options={[
                      { value: "KOSPI", label: "KOSPI" },
                      { value: "KOSDAQ", label: "KOSDAQ" },
                    ]}
                  />
                </div>
                <button
                  onClick={loadUniverse}
                  disabled={uLoading}
                  className="h-8 px-5 bg-accent text-black text-xs font-semibold rounded cursor-pointer hover:brightness-110 transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed">
                  {uLoading ? "불러오는 중…" : "불러오기"}
                </button>
                {uRows.length > 0 && (
                  <span className="text-text-3 text-xs">종목 {uRows.length}개 불러옴</span>
                )}
              </div>

              {uRows.length > 0 && (
                <>
                  <div className="space-y-1">
                    <label className="text-text-3 text-[11px] uppercase tracking-wider">검색</label>
                    <input
                      value={uSearch}
                      onChange={e => setUSearch(e.target.value)}
                      placeholder="종목명 또는 코드..."
                      className="h-8 px-3 text-xs bg-panel-2 border border-border rounded text-text-1 placeholder:text-text-3 outline-none focus:border-accent w-64"/>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-text-3 text-[11px] uppercase tracking-wider shrink-0">최대 시가총액</label>
                    <input
                      type="range" min={0} max={uMktcapMax} step={uMktcapMax / 100}
                      value={uMaxCap}
                      onChange={e => setUMaxCap(parseFloat(e.target.value))}
                      className="flex-1"
                      style={{ accentColor: TOKEN.accent }}/>
                    <span className="text-text-2 text-xs font-data w-16 text-right">{formatMktcap(uMaxCap || null)}</span>
                  </div>
                </>
              )}
            </div>

            {uError && (
              <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">{uError}</div>
            )}

            {uFiltered.length > 0 && (
              <Panel>
                <PanelHeader>
                  종목 {uFiltered.length}개
                  {uSearch || uMaxCap < uMktcapMax ? ` (전체 ${uRows.length}개 중 필터링됨)` : ""}
                </PanelHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {["종목명", "코드", "시장", "시가총액", "작업"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-text-3 font-normal text-[10px] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uFiltered.slice(0, 200).map((row, i) => {
                        const isu_cd = row.isu_cd ?? "";
                        const inWl = uInWatchlist(isu_cd);
                        return (
                          <tr key={i} className="border-b border-border/40 hover:bg-panel-2 transition-colors">
                            <td className="px-4 py-1.5 text-text-1">{row.isu_nm ?? "—"}</td>
                            <td className="px-4 py-1.5 text-text-3 font-data">{isu_cd}</td>
                            <td className="px-4 py-1.5 text-text-3">{row.mkt_nm ?? "—"}</td>
                            <td className="px-4 py-1.5 text-text-2 font-data text-right">{formatMktcap(row.mktcap)}</td>
                            <td className="px-4 py-1.5">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => uHandleAddWatchlist(isu_cd)}
                                  disabled={inWl}
                                  className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer transition-colors ${
                                    inWl ? "border-border text-text-3 cursor-default" : "border-border text-text-3 hover:border-accent hover:text-accent"}`}>
                                  {inWl ? "✓ 관심종목" : "+ 관심종목"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {uFiltered.length > 200 && (
                    <div className="px-4 py-2 text-text-3 text-xs border-t border-border">
                      상위 200개만 표시 중 (전체 {uFiltered.length}개). 검색 조건을 좁혀 더 보기.
                    </div>
                  )}
                </div>
              </Panel>
            )}

            {uRows.length > 0 && uFiltered.length === 0 && (
              <div className="text-center py-8 text-text-3 text-sm">현재 필터 조건에 맞는 종목이 없습니다.</div>
            )}

            {uRows.length === 0 && !uLoading && !uError && (
              <div className="text-center py-12 text-text-3 text-sm">시장을 선택하고 불러오기를 눌러 전체 종목을 확인하세요.</div>
            )}
          </div>
        )}

        {activeTab === "스크리너" && (
          <div className="p-4 space-y-4 max-w-[900px]">
            <p className="text-text-3 text-xs">RSI + EMA 조건으로 종목 필터링 · 기존 bar 데이터 사용</p>

            {/* Filter panel */}
            <div className="bg-panel border border-border rounded-lg p-4 space-y-4">
              {/* Instrument input */}
              <div>
                <label className="text-text-3 text-xs block mb-1.5">종목 목록 (쉼표 구분, 최대 30개)</label>
                <textarea
                  value={instruments}
                  onChange={e => setInstruments(e.target.value)}
                  placeholder="AAPL,MSFT,GOOGL,NVDA…"rows={2}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-text-1 text-xs font-data resize-none focus:border-accent outline-none"/>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {PRESET_UNIVERSES.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setInstruments(p.value)}
                      className="text-[10px] text-text-3 hover:text-accent border border-border rounded px-2 py-0.5 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <label className="text-text-3 text-xs block mb-1">RSI 최솟값</label>
                  <input
                    type="number" value={rsiMin} onChange={e => setRsiMin(e.target.value)}
                    placeholder="0"className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs font-data focus:border-accent outline-none"/>
                </div>
                <div>
                  <label className="text-text-3 text-xs block mb-1">RSI 최댓값</label>
                  <input
                    type="number" value={rsiMax} onChange={e => setRsiMax(e.target.value)}
                    placeholder="100"className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs font-data focus:border-accent outline-none"/>
                </div>
                <div>
                  <label className="text-text-3 text-xs block mb-1">EMA 시그널</label>
                  <select
                    value={emaSignal} onChange={e => setEmaSignal(e.target.value)}
                    className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs focus:border-accent outline-none">
                    {EMA_SIGNAL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-text-3 text-xs block mb-1">기간 (일)</label>
                  <select
                    value={screenerDays} onChange={e => setScreenerDays(Number(e.target.value))}
                    className="w-full bg-bg border border-border rounded px-2 py-1.5 text-text-1 text-xs focus:border-accent outline-none">
                    {[20, 30, 60, 90, 120, 180, 365].map(d => (
                      <option key={d} value={d}>{d}일</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleRun}
                disabled={screenerLoading || !instruments.trim()}>
                {screenerLoading ? "스크리닝 중…" : "스크리너 실행"}
              </Button>
            </div>

            {screenerError && <p className="text-neg text-sm">{screenerError}</p>}

            {/* Results */}
            {screenerResults.length > 0 && (
              <Panel>
                <PanelHeader>{screenerResults.length}개 종목 조건 충족</PanelHeader>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-3 text-[10px] uppercase border-b border-border">
                      <th className="px-4 py-2 text-left">종목</th>
                      <th className="px-3 py-2 text-right">가격</th>
                      <th className="px-3 py-2 text-right">변동</th>
                      <th className="px-3 py-2 text-right">RSI(14)</th>
                      <th className="px-3 py-2 text-right">EMA12</th>
                      <th className="px-3 py-2 text-right">EMA26</th>
                      <th className="px-3 py-2 text-center">신호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenerResults.map((r, i) => {
                      const chgPos = (r.change_pct ?? 0) >= 0;
                      const badge = EMA_BADGE[r.ema_signal] ?? EMA_BADGE.neutral;
                      return (
                        <tr key={i} className="border-t border-border hover:bg-panel-2 transition-colors">
                          <td className="px-4 py-2 font-data font-semibold text-accent">{r.instrument_id}</td>
                          <td className="px-3 py-2 text-right font-data text-text-1">{r.last_price.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-data">
                            <span className={`px-1 font-bold ${chgPos ? "bg-pos/20 text-pos" : "bg-neg/20 text-neg"}`}>
                              {r.change_pct != null ? `${chgPos ? "+" : ""}${r.change_pct.toFixed(2)}%` : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-data font-medium">
                            <span className={`px-1 ${
                              r.rsi14 == null ? "text-text-3": r.rsi14 < 30 ? "bg-pos/20 text-pos font-bold": r.rsi14 > 70 ? "bg-neg/20 text-neg font-bold": "text-text-1"}`}>
                              {r.rsi14 != null ? r.rsi14.toFixed(1) : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-data text-text-2">
                            {r.ema12 != null ? r.ema12.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-data text-text-2">
                            {r.ema26 != null ? r.ema26.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            )}

            {!screenerLoading && screenerResults.length === 0 && instruments && !screenerError && (
              <div className="bg-panel border border-border rounded-lg p-8 text-center text-text-3 text-sm">
                조건에 맞는 종목 없음
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
