"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  ApiError,
  getCryptoAssets, getCryptoBook,
  type CryptoAssetsResponse,
  type CryptoBookResponse,
} from "@/lib/api";
import { ChartTab } from "@/components/market/ChartTab";
import { TradeTab } from "@/components/market/TradeTab";
import { AlertTab } from "@/components/market/AlertTab";
import { IndicatorTab } from "@/components/market/IndicatorTab";
import { DEFAULT_INDICATORS, activeIndicatorCount, type IndicatorState } from "@/lib/indicators";
import { TOKEN } from "@/lib/chart-colors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(v: number): string { return v.toFixed(2); }
function fmt4(v: number): string { return v.toFixed(4); }

function fmtPrice(v: number): string {
  return v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toFixed(6);
}

function fmtVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}

function changeCls(v: number): string {
  return v > 0 ? "bg-pos/20 text-pos" : v < 0 ? "bg-neg/20 text-neg" : "text-text-3";
}

function fundingCls(v: number): string {
  return v > 0 ? "bg-warn/20 text-warn" : v < 0 ? "bg-info/20 text-info" : "text-text-3";
}

type AssetRow = CryptoAssetsResponse["assets"][number];

// ── Watchlist Storage ──────────────────────────────────────────────────────────

const CRYPTO_KEY = "seokminal:crypto-watchlist";
const DEFAULT_COINS = ["BTC", "ETH", "SOL"];

function getCryptoWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(CRYPTO_KEY);
    if (!raw) return [...DEFAULT_COINS];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_COINS];
  } catch {
    return [...DEFAULT_COINS];
  }
}

function addCryptoToWatchlist(coin: string): void {
  const list = getCryptoWatchlist();
  if (list.includes(coin)) return;
  localStorage.setItem(CRYPTO_KEY, JSON.stringify([...list, coin]));
}

function removeCryptoFromWatchlist(coin: string): void {
  localStorage.setItem(CRYPTO_KEY, JSON.stringify(getCryptoWatchlist().filter(c => c !== coin)));
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function CryptoSidebar({
  coins, activeCoin, assetMap, onSelect, onRemove,
}: {
  coins: string[];
  activeCoin: string;
  assetMap: Record<string, AssetRow>;
  onSelect: (c: string) => void;
  onRemove: (c: string) => void;
}) {
  return (
    <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-panel h-full">
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">워치리스트</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {coins.length === 0 && (
          <p className="text-text-3 text-xs text-center py-6 px-2">검색에서 코인 추가</p>
        )}
        {coins.map(coin => {
          const d = assetMap[coin];
          const isActive = coin === activeCoin;
          const pos = (d?.day_change_pct ?? 0) >= 0;
          return (
            <div
              key={coin}
              onClick={() => onSelect(coin)}
              className={`px-3 py-2 border-b border-border/40 cursor-pointer group ${
                isActive ? "bg-panel-2" : "hover:bg-panel-2/50"}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs font-semibold ${isActive ? "text-text-1" : "text-text-2"}`}>
                  {coin}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onRemove(coin); }}
                  className="text-text-3 hover:text-neg text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-0 cursor-pointer p-0 leading-none">
                  ×
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-3 font-data">
                  {d ? fmtPrice(d.mid_price) : "…"}
                </span>
                {d && (
                  <span className={`text-[10px] font-data px-1 ${changeCls(d.day_change_pct)}`}>
                    {pos ? "+" : ""}{d.day_change_pct.toFixed(2)}%
                  </span>
                )}
              </div>
              {d && (
                <div className="mt-0.5">
                  <span className={`text-[9px] font-data px-1 ${fundingCls(d.funding_rate_8h)}`}>
                    F {d.funding_rate_8h >= 0 ? "+" : ""}{d.funding_rate_8h.toFixed(4)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ── Book Panel ─────────────────────────────────────────────────────────────────

function CoinBookPanel({ coin }: { coin: string }) {
  const [result, setResult] = useState<CryptoBookResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const abortRef             = useRef<AbortController | null>(null);
  const svgRef               = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null); setResult(null);
    getCryptoBook(coin, ctrl.signal)
      .then(r => { if (!ctrl.signal.aborted) setResult(r); })
      .catch(e => { if (e instanceof DOMException && e.name === "AbortError") return; setError(e instanceof ApiError ? e.message : "실패"); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [coin]);

  useEffect(() => {
    if (!result || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (!result.bids.length || !result.asks.length) return;
    const el = svgRef.current.parentElement;
    const W = el ? el.clientWidth - 8 : 400;
    const H = 160;
    const margin = { top: 16, right: 16, bottom: 28, left: 60 };
    const iW = W - margin.left - margin.right;
    const iH = H - margin.top - margin.bottom;
    const g = svg.attr("width", W).attr("height", H)
      .append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const N = 15;
    const bids = result.bids.slice(0, N);
    const asks = result.asks.slice(0, N);
    const bidCum: { price: number; cumSize: number }[] = [];
    bids.forEach((l, i) => bidCum.push({ price: l.price, cumSize: (bidCum[i-1]?.cumSize ?? 0) + l.size }));
    const askCum: { price: number; cumSize: number }[] = [];
    asks.forEach((l, i) => askCum.push({ price: l.price, cumSize: (askCum[i-1]?.cumSize ?? 0) + l.size }));
    const allPrices = [...bidCum.map(d => d.price), ...askCum.map(d => d.price)];
    const maxCum = Math.max(...bidCum.map(d => d.cumSize), ...askCum.map(d => d.cumSize));
    const xScale = d3.scaleLinear().domain([d3.min(allPrices)! * 0.9995, d3.max(allPrices)! * 1.0005]).range([0, iW]);
    const yScale = d3.scaleLinear().domain([0, maxCum * 1.05]).range([iH, 0]);
    const bidArea = d3.area<{ price: number; cumSize: number }>().x(d => xScale(d.price)).y0(iH).y1(d => yScale(d.cumSize)).curve(d3.curveStepAfter);
    const askArea = d3.area<{ price: number; cumSize: number }>().x(d => xScale(d.price)).y0(iH).y1(d => yScale(d.cumSize)).curve(d3.curveStepBefore);
    g.append("path").datum([...bidCum].reverse()).attr("d", bidArea).attr("fill", TOKEN.pos).attr("opacity", 0.3);
    g.append("path").datum([...bidCum].reverse()).attr("d", d3.line<{ price: number; cumSize: number }>().x(d => xScale(d.price)).y(d => yScale(d.cumSize)).curve(d3.curveStepAfter)).attr("fill", "none").attr("stroke", TOKEN.pos).attr("stroke-width", 1.5);
    g.append("path").datum(askCum).attr("d", askArea).attr("fill", TOKEN.neg).attr("opacity", 0.3);
    g.append("path").datum(askCum).attr("d", d3.line<{ price: number; cumSize: number }>().x(d => xScale(d.price)).y(d => yScale(d.cumSize)).curve(d3.curveStepBefore)).attr("fill", "none").attr("stroke", TOKEN.neg).attr("stroke-width", 1.5);
    g.append("line").attr("x1", xScale(result.mid_price)).attr("x2", xScale(result.mid_price)).attr("y1", 0).attr("y2", iH).attr("stroke", TOKEN.text2).attr("stroke-width", 1).attr("stroke-dasharray", "4 4");
    g.append("g").attr("transform", `translate(0,${iH})`).call(d3.axisBottom(xScale).ticks(5).tickFormat(d => String(+d))).call(ax => ax.select(".domain").remove()).call(ax => ax.selectAll("text").attr("fill", TOKEN.text2).attr("font-size", 9)).call(ax => ax.selectAll(".tick line").remove());
    g.append("g").call(d3.axisLeft(yScale).ticks(4)).call(ax => ax.select(".domain").remove()).call(ax => ax.selectAll("text").attr("fill", TOKEN.text2).attr("font-size", 9)).call(ax => ax.selectAll(".tick line").attr("stroke", TOKEN.border).attr("x2", iW));
  }, [result]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-text-3 text-[10px] uppercase tracking-wider">오더북 뎁스</span>
        {result && (
          <span className="text-text-3 text-[11px]">
            스프레드: <span className="text-text-1 font-data">{result.spread.toFixed(4)}</span>
            {" "}(<span className="text-text-1 font-data">{result.spread_pct.toFixed(4)}%</span>)
          </span>
        )}
      </div>
      {error && <p className="text-neg text-[11px] px-3 py-1">{error}</p>}
      {loading && <div className="flex-1 flex items-center justify-center text-text-3 text-xs">로딩 중…</div>}
      <div className="flex-1 overflow-hidden px-1 pt-1">
        <svg ref={svgRef} className="block" />
      </div>
    </div>
  );
}

// ── Search Tab ─────────────────────────────────────────────────────────────────

function SearchTab({
  watchlist,
  onAdd,
}: {
  watchlist: string[];
  onAdd: (coin: string) => void;
}) {
  const [assets, setAssets]   = useState<CryptoAssetsResponse | null>(null);
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    getCryptoAssets(ctrl.signal)
      .then(r => { if (!ctrl.signal.aborted) setAssets(r); })
      .catch(() => {})
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, []);

  const filtered = (assets?.assets ?? []).filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          placeholder="코인 검색…"autoFocus
          className="bg-bg border border-border rounded px-3 py-1.5 text-text-1 text-sm font-data w-48 focus:border-accent outline-none"/>
        {assets && (
          <span className="text-text-3 text-xs">{assets.count}개 마켓 · Hyperliquid Perps</span>
        )}
      </div>
      {loading && <p className="text-text-3 text-sm">로딩 중…</p>}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse font-data">
            <thead>
              <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
                <th className="px-3 py-2 text-left font-medium">코인</th>
                <th className="px-3 py-2 text-right font-medium">가격</th>
                <th className="px-3 py-2 text-right font-medium">24h%</th>
                <th className="px-3 py-2 text-right font-medium">펀딩(8h)</th>
                <th className="px-3 py-2 text-right font-medium">OI</th>
                <th className="px-3 py-2 text-right font-medium">거래량</th>
                <th className="px-3 py-2 text-center font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const inList = watchlist.includes(a.name);
                return (
                  <tr key={a.name} className="border-t border-border/50 hover:bg-panel-2 transition-colors">
                    <td className="px-3 py-1.5 font-bold text-accent">{a.name}</td>
                    <td className="px-3 py-1.5 text-right text-text-1">{fmtPrice(a.mid_price)}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${changeCls(a.day_change_pct)}`}>
                      {a.day_change_pct >= 0 ? "+" : ""}{fmt2(a.day_change_pct)}%
                    </td>
                    <td className={`px-3 py-1.5 text-right ${fundingCls(a.funding_rate_8h)}`}>
                      {a.funding_rate_8h >= 0 ? "+" : ""}{fmt4(a.funding_rate_8h)}%
                    </td>
                    <td className="px-3 py-1.5 text-right text-text-2">{fmt2(a.open_interest)}</td>
                    <td className="px-3 py-1.5 text-right text-text-3">{fmtVolume(a.day_volume)}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => onAdd(a.name)}
                        disabled={inList}
                        className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                          inList
                            ? "border-border text-text-3 cursor-not-allowed": "border-accent text-accent hover:bg-accent/10"}`}
                      >
                        {inList ? "추가됨" : "+ 추가"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Stats Tab ──────────────────────────────────────────────────────────────────

function StatsTab({
  watchlist,
  assetMap,
}: {
  watchlist: string[];
  assetMap: Record<string, AssetRow>;
}) {
  const coins = watchlist.map(c => assetMap[c]).filter(Boolean);

  if (coins.length === 0) {
    return (
      <div className="p-6 text-text-3 text-sm text-center py-16">
        워치리스트가 비어 있음
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full text-xs border-collapse font-data">
        <thead>
          <tr className="bg-panel-2 text-text-3 text-[10px] uppercase tracking-wider border-b border-border">
            <th className="px-3 py-2 text-left font-medium">코인</th>
            <th className="px-3 py-2 text-right font-medium">가격</th>
            <th className="px-3 py-2 text-right font-medium">24h%</th>
            <th className="px-3 py-2 text-right font-medium">펀딩 8h%</th>
            <th className="px-3 py-2 text-right font-medium">펀딩 연환산%</th>
            <th className="px-3 py-2 text-right font-medium">OI</th>
            <th className="px-3 py-2 text-right font-medium">24h 거래량</th>
          </tr>
        </thead>
        <tbody>
          {coins.map(a => (
            <tr key={a.name} className="border-t border-border hover:bg-panel-2 transition-colors">
              <td className="px-3 py-2 font-bold text-accent">{a.name}</td>
              <td className="px-3 py-2 text-right text-text-1">{fmtPrice(a.mid_price)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${changeCls(a.day_change_pct)}`}>
                {a.day_change_pct >= 0 ? "+" : ""}{fmt2(a.day_change_pct)}%
              </td>
              <td className={`px-3 py-2 text-right ${fundingCls(a.funding_rate_8h)}`}>
                {a.funding_rate_8h >= 0 ? "+" : ""}{fmt4(a.funding_rate_8h)}%
              </td>
              <td className={`px-3 py-2 text-right font-semibold ${fundingCls(a.funding_rate)}`}>
                {a.funding_rate >= 0 ? "+" : ""}{fmt2(a.funding_rate)}%
              </td>
              <td className="px-3 py-2 text-right text-text-2">{fmt2(a.open_interest)}</td>
              <td className="px-3 py-2 text-right text-text-3">{fmtVolume(a.day_volume)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "search" | "workspace" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "search",    label: "검색" },
  { id: "workspace", label: "워크스페이스" },
  { id: "stats",     label: "통계" },
];

type Side = "trade" | "alert" | "indicators" | "book";

export default function CryptoPage() {
  const [watchlist, setWatchlist]   = useState<string[]>(DEFAULT_COINS);
  const [activeCoin, setActiveCoin] = useState("BTC");
  const [tab, setTab]               = useState<Tab>("workspace");
  const [assetMap, setAssetMap]     = useState<Record<string, AssetRow>>({});
  const [indicators, setIndicators] = useState<IndicatorState>(DEFAULT_INDICATORS);
  const [side, setSide]             = useState<Side>("trade");
  const [rightOpen, setRightOpen]   = useState(true);

  useEffect(() => {
    const list = getCryptoWatchlist();
    setWatchlist(list);
    setActiveCoin(list[0] ?? "BTC");
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    getCryptoAssets(ctrl.signal)
      .then(r => {
        if (ctrl.signal.aborted) return;
        const map: Record<string, AssetRow> = {};
        for (const a of r.assets) map[a.name] = a;
        setAssetMap(map);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  function handleAdd(coin: string) {
    addCryptoToWatchlist(coin);
    const updated = getCryptoWatchlist();
    setWatchlist(updated);
    setActiveCoin(coin);
    setTab("workspace");
  }

  function handleRemove(coin: string) {
    removeCryptoFromWatchlist(coin);
    const updated = getCryptoWatchlist();
    setWatchlist(updated);
    if (activeCoin === coin) setActiveCoin(updated[0] ?? "BTC");
  }

  function handleSelect(coin: string) {
    setActiveCoin(coin);
    setTab("workspace");
  }

  return (
    <div className="flex h-[calc(100vh-144px)] overflow-hidden">
      <CryptoSidebar
        coins={watchlist}
        activeCoin={activeCoin}
        assetMap={assetMap}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center border-b border-border px-4 bg-panel shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 ${
                tab === t.id
                  ? "border-accent text-accent font-medium": "border-transparent text-text-3 hover:text-text-1"}`}
            >
              {t.label}
            </button>
          ))}
          {tab === "workspace" && (
            <span className="ml-auto text-text-3 text-xs font-data">{activeCoin}/USDT · Hyperliquid</span>
          )}
        </div>

        <div className="flex-1 overflow-hidden bg-bg">
          {tab === "search" && (
            <div className="h-full overflow-y-auto">
              <SearchTab watchlist={watchlist} onAdd={handleAdd} />
            </div>
          )}
          {tab === "workspace" && (
            <div className="flex h-full">
              {/* 차트 (주식과 동일한 ChartTab: 타임프레임·지표) */}
              <div className="flex-1 overflow-y-auto min-w-0">
                <ChartTab
                  symbol={`${activeCoin}.HL`}
                  indicators={indicators}
                  setIndicators={setIndicators}
                />
              </div>
              {/* 우측: 매매 / 알림 / 지표 / 호가 (주식과 통일) */}
              {rightOpen ? (
                <div className="w-[340px] border-l border-border flex flex-col shrink-0">
                  <div className="flex items-center border-b border-border shrink-0">
                    {([["trade", " 매매"], ["alert", " 알림"], ["indicators", " 지표"], ["book", " 호가"]] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setSide(v)}
                        className={`flex-1 py-2.5 text-[11px] border-b-2 bg-transparent cursor-pointer transition-colors ${
                          side === v ? "border-accent text-accent" : "border-transparent text-text-3 hover:text-text-1"}`}>
                        {label}{v === "indicators" && activeIndicatorCount(indicators) > 0 ? ` ${activeIndicatorCount(indicators)}` : ""}
                      </button>
                    ))}
                    <button onClick={() => setRightOpen(false)} title="패널 접기"className="w-7 h-9 flex items-center justify-center text-text-3 hover:text-text-1 bg-transparent border-0 cursor-pointer shrink-0">▶</button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {side === "trade" && <TradeTab symbol={`${activeCoin}.HL`} />}
                    {side === "alert" && <AlertTab symbol={`${activeCoin}.HL`} />}
                    {side === "indicators" && <IndicatorTab indicators={indicators} setIndicators={setIndicators} />}
                    {side === "book" && <div className="h-56"><CoinBookPanel coin={activeCoin} /></div>}
                  </div>
                </div>
              ) : (
                <button onClick={() => setRightOpen(true)} title="패널 열기"className="w-10 border-l border-border shrink-0 flex flex-col items-center justify-center gap-2 text-accent hover:bg-accent/10 bg-panel-2 cursor-pointer border-y-0 border-r-0">
                  <span className="text-sm">◀</span>
                  <span className="text-[11px]" style={{ writingMode: "vertical-rl" }}> 매매 ·  알림 ·  지표 ·  호가</span>
                </button>
              )}
            </div>
          )}
          {tab === "stats" && (
            <div className="h-full overflow-y-auto">
              <StatsTab watchlist={watchlist} assetMap={assetMap} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
