"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "@/components/ui";
import {
  getQuote, getCryptoBook, WS_URL,
  type BarOut,
} from "@/lib/api";
import { fetchBarsForSymbol } from "@/lib/chart-bars";
import { isUSMarketOpen } from "@/lib/market-hours";
import { activeIndicatorChips, type IndicatorState } from "@/lib/indicators";
import { RSIChart } from "./RSIChart";
import { MACDChart } from "./MACDChart";
import { StochasticChart } from "./StochasticChart";
import { ATRChart } from "./ATRChart";
import { VolumeChart } from "./VolumeChart";
import { OBVChart } from "./OBVChart";
import { ADXChart } from "./ADXChart";
import { CCIChart } from "./CCIChart";
import { WilliamsRChart } from "./WilliamsRChart";

interface ChartTabProps {
  symbol: string;
  indicators: IndicatorState;
  setIndicators: Dispatch<SetStateAction<IndicatorState>>;
  onAddToWatchlist?: (symbol: string) => void;
  isInWatchlist?: boolean;
}

// 바 간격 타임프레임. US=IB(전부), KR=하루/1달(KIS).
const TIMEFRAMES = [
  { id: "1m",  label: "1분",   bar: "1 min" as const,   dur: "2 D" },
  { id: "15m", label: "15분",  bar: "15 mins" as const, dur: "5 D" },
  { id: "1h",  label: "1시간", bar: "1 hour" as const,  dur: "1 M" },
  { id: "4h",  label: "4시간", bar: "4 hours" as const, dur: "3 M" },
  { id: "1d",  label: "하루",  bar: "1 day" as const,   dur: "2 Y" },
  { id: "1M",  label: "1달",   bar: "1 month" as const, dur: "10 Y" },
];

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChartTab({ symbol, indicators, setIndicators, onAddToWatchlist, isInWatchlist }: ChartTabProps) {
  const router = useRouter();
  const [start] = useState(oneYearAgo);
  const [end] = useState(today);
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"off" | "live">("off");
  const [tf, setTf] = useState("1d");
  const abortRef = useRef<AbortController | null>(null);

  async function loadBars(tfId: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null); setBars([]);

    const cfg = TIMEFRAMES.find(t => t.id === tfId) ?? TIMEFRAMES[4];
    const venue = symbol.split(".").slice(1).join(".");
    const isDaily = tfId === "1d";

    try {
      const bars = await fetchBarsForSymbol(symbol, tfId, ctrl.signal);
      setBars(bars);
    } catch (err2) {
      if (err2 instanceof DOMException && err2.name === "AbortError") return;
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      // 미국 분봉/월봉은 IB(TWS) 필요 — 연결 안 되면 친절히 안내
      if (!isDaily && venue !== "XKRX" && venue !== "HL") {
        setError(`미국 ${cfg.label} 차트는 IB(TWS) 연결이 필요합니다. TWS를 켜고 다시 선택하세요. (하루봉은 TWS 없이도 표시)`);
      } else {
        setError(`'${symbol}' ${cfg.label} 로드 실패: ${msg2}`);
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    loadBars(tf);
    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf]);

  // ── Real-time last-candle update (US=Finnhub poll, KR=KIS ws) ─────────────
  function applyLivePrice(price: number) {
    if (price <= 0) return;
    setBars(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const updated: BarOut = {
        ...last, close: price,
        high: Math.max(last.high, price), low: Math.min(last.low, price),
      };
      return [...prev.slice(0, -1), updated];
    });
  }

  useEffect(() => {
    if (bars.length === 0) { setLiveStatus("off"); return; }
    const venue = symbol.split(".").slice(1).join(".");

    if (venue === "HL") {
      // 크립토: Hyperliquid 북 mid 5초 폴링 (24/7 시장)
      const code = symbol.split(".")[0];
      let cancelled = false;
      const ctrl = new AbortController();
      async function poll() {
        try {
          const b = await getCryptoBook(code, ctrl.signal);
          if (!cancelled && b.mid_price > 0) { applyLivePrice(b.mid_price); setLiveStatus("live"); }
        } catch {
          if (!cancelled) setLiveStatus("off");
        }
      }
      poll();
      const id = setInterval(poll, 5000);
      return () => { cancelled = true; ctrl.abort(); clearInterval(id); };
    }

    if (venue === "XKRX") {
      const code = symbol.split(".")[0];
      const ws = new WebSocket(`${WS_URL}/ws/live/${code}`);
      ws.onopen = () => setLiveStatus("live");
      ws.onclose = () => setLiveStatus("off");
      ws.onerror = () => setLiveStatus("off");
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.error) { setLiveStatus("off"); return; }
          const p = Number(msg.price);
          if (p > 0) { applyLivePrice(p); setLiveStatus("live"); }
        } catch { /* ignore malformed frame */ }
      };
      return () => ws.close();
    }

    // US stock → poll Finnhub quote every 5s (장 마감 시엔 첫 1회만, 이후 스킵)
    const usSymbol = symbol.split(".")[0];
    let cancelled = false;
    let fetchedOnce = false;
    const ctrl = new AbortController();
    async function poll() {
      // 마감 + 이미 최신가 있음 → 네트워크·한도 아끼려 스킵
      if (fetchedOnce && !isUSMarketOpen()) { setLiveStatus("off"); return; }
      try {
        const q = await getQuote(usSymbol, ctrl.signal);
        fetchedOnce = true;
        if (!cancelled) { applyLivePrice(q.price); setLiveStatus(isUSMarketOpen() ? "live" : "off"); }
      } catch {
        if (!cancelled) setLiveStatus("off");
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; ctrl.abort(); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, bars.length]);

  const chips = activeIndicatorChips(indicators);

  function removeIndicator(key: keyof IndicatorState) {
    setIndicators(prev => ({ ...prev, [key]: { ...prev[key], on: false } }));
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Row 1: 타임프레임(바 간격) + 백테스트 */}
      <div className="flex items-center gap-1 flex-wrap">
        {TIMEFRAMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTf(t.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
              tf === t.id ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-accent hover:border-accent bg-panel-2"}`}
          >{t.label}</button>
        ))}
        <span className="text-border text-xs ml-1">|</span>
        <button
          onClick={() => {
            const params = new URLSearchParams({ instrument: symbol, start, end });
            if (indicators.ema.on) {
              params.set("strategy", "ema_cross");
              params.set("fast", String(indicators.ema.fast));
              params.set("slow", String(indicators.ema.slow));
            }
            router.push(`/backtest?${params.toString()}`);
          }}
          className="px-3 h-7 text-xs font-medium rounded border border-border text-text-2 hover:border-accent hover:text-accent bg-transparent cursor-pointer transition-colors"title="이 종목으로 백테스팅">
          백테스트 →
        </button>
        {onAddToWatchlist && (
          <button
            onClick={() => onAddToWatchlist(symbol)}
            className={`px-3 h-7 text-xs font-medium rounded border cursor-pointer transition-colors ${
              isInWatchlist
                ? "border-accent text-accent bg-accent/10": "border-border text-text-2 hover:border-accent hover:text-accent bg-transparent"}`}
            title="워치리스트에 추가">
            {isInWatchlist ? "★ 워치리스트" : "☆ 워치리스트"}
          </button>
        )}
        {!loading && bars.length > 0 && (
          <span className="text-text-3 text-xs font-data">{bars.length} bars</span>
        )}
      </div>

      {/* Row 2: Active indicator chips (관리는 우측  지표 탭) */}
      <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
        {chips.length > 0 ? (
          chips.map(ind => (
            <span
              key={ind.key}
              className="px-2 py-0.5 text-xs rounded border border-accent/40 text-accent bg-accent/5 flex items-center gap-1">
              {ind.label}
              <button
                onClick={() => removeIndicator(ind.key)}
                className="text-text-3 hover:text-neg cursor-pointer leading-none"aria-label={`Remove ${ind.label}`}
              >
                ✕
              </button>
            </span>
          ))
        ) : (
          <span className="text-text-3 text-xs">지표 없음 — 우측  지표 탭에서 추가</span>
        )}
      </div>

      {error && (
        <div className="text-neg text-sm bg-neg/10 border border-neg/20 rounded-md px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="bg-panel border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-panel-2 flex items-center gap-3">
          <span className="font-data text-sm text-text-1 font-medium">{symbol}</span>
          {bars.length > 0 && (
            <span className="font-data text-sm text-text-1">
              {bars[bars.length - 1].close.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
          )}
          <span className="flex items-center gap-1.5 ml-auto">
            <span className={`w-1.5 h-1.5 rounded-full ${liveStatus === "live" ? "bg-pos animate-pulse" : "bg-text-3"}`} />
            <span className={`text-[11px] uppercase tracking-wider ${liveStatus === "live" ? "text-pos" : "text-text-3"}`}>
              {liveStatus === "live" ? "실시간" : "대기"}
            </span>
          </span>
        </div>
        {bars.length > 0 ? (
          <>
            <CandlestickChart
              bars={bars}
              emaFast={indicators.ema.on ? indicators.ema.fast : undefined}
              emaSlow={indicators.ema.on ? indicators.ema.slow : undefined}
              sma={indicators.sma.on ? indicators.sma.period : undefined}
              bollingerPeriod={indicators.bb.on ? indicators.bb.period : undefined}
              bollingerStd={indicators.bb.on ? indicators.bb.std : undefined}
            />
            {indicators.rsi.on && <RSIChart bars={bars} period={indicators.rsi.period} />}
            {indicators.macd.on && <MACDChart bars={bars} fast={indicators.macd.fast} slow={indicators.macd.slow} signal={indicators.macd.signal} />}
            {indicators.stoch.on && <StochasticChart bars={bars} kPeriod={indicators.stoch.k} dPeriod={indicators.stoch.d} />}
            {indicators.cci.on && <CCIChart bars={bars} period={indicators.cci.period} />}
            {indicators.wr.on && <WilliamsRChart bars={bars} period={indicators.wr.period} />}
            {indicators.adx.on && <ADXChart bars={bars} period={indicators.adx.period} />}
            {indicators.atr.on && <ATRChart bars={bars} period={indicators.atr.period} />}
            {indicators.volume.on && <VolumeChart bars={bars} />}
            {indicators.obv.on && <OBVChart bars={bars} />}
          </>
        ) : (
          <div className="h-[480px] flex items-center justify-center">
            <EmptyState message="No chart data" hint={error ? "" : "Click Load to fetch bars"} />
          </div>
        )}
      </div>
    </div>
  );
}
