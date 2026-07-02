"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CandlestickChart } from "@/components/CandlestickChart";
import { EmptyState } from "@/components/ui";
import {
  ApiError, getBars, getKRBars, getIBBars, getQuote, WS_URL,
  type BarOut, type KRBar, type IBBar,
} from "@/lib/api";
import { isUSMarketOpen } from "@/lib/market-hours";

function krBarToBarOut(bar: KRBar): BarOut {
  const d = bar.date;
  const tsMs = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`).getTime();
  return { ts_event: tsMs * 1_000_000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}

function ibBarToBarOut(bar: IBBar): BarOut {
  return { ts_event: bar.ts_ms * 1_000_000, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}
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

interface ParamInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  width?: string;
}

function ParamInput({ value, onChange, min = 1, max = 500, width = "w-12" }: ParamInputProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className={`${width} h-6 text-xs text-center bg-bg border border-border rounded text-text-1 outline-none focus:border-accent font-data`}
      onClick={e => e.stopPropagation()}
    />
  );
}

export function ChartTab({ symbol, onAddToWatchlist, isInWatchlist }: ChartTabProps) {
  const router = useRouter();
  const [start, setStart] = useState(oneYearAgo);
  const [end, setEnd] = useState(today);
  const [bars, setBars] = useState<BarOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"off" | "live">("off");
  const [tf, setTf] = useState("1d");
  const abortRef = useRef<AbortController | null>(null);

  // Overlay indicators
  const [showSma, setShowSma] = useState(false);
  const [smaPeriod, setSmaPeriod] = useState(20);
  const [showEma, setShowEma] = useState(false);
  const [emaFast, setEmaFast] = useState(12);
  const [emaSlow, setEmaSlow] = useState(26);
  const [showBB, setShowBB] = useState(false);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbStd, setBbStd] = useState(2);

  // Oscillators
  const [showRsi, setShowRsi] = useState(false);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [showMacd, setShowMacd] = useState(false);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSig, setMacdSig] = useState(9);
  const [showStoch, setShowStoch] = useState(false);
  const [stochK, setStochK] = useState(14);
  const [stochD, setStochD] = useState(3);
  const [showCci, setShowCci] = useState(false);
  const [cciPeriod, setCciPeriod] = useState(20);
  const [showWilliamsR, setShowWilliamsR] = useState(false);
  const [wrPeriod, setWrPeriod] = useState(14);

  // Trend / Volatility
  const [showAdx, setShowAdx] = useState(false);
  const [adxPeriod, setAdxPeriod] = useState(14);
  const [showAtr, setShowAtr] = useState(false);
  const [atrPeriod, setAtrPeriod] = useState(14);

  // Volume
  const [showVolume, setShowVolume] = useState(false);
  const [showObv, setShowObv] = useState(false);

  // Panel
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  async function loadBars(tfId: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setError(null); setBars([]);

    const cfg = TIMEFRAMES.find(t => t.id === tfId) ?? TIMEFRAMES[4];
    const venue = symbol.split(".").slice(1).join(".");
    const isDaily = tfId === "1d";
    const isIntraday = ["1m", "15m", "1h", "4h"].includes(tfId);

    try {
      if (venue === "XKRX") {
        // KR: 하루/1달만 (KIS 일봉). 인트라데이 미지원.
        if (isIntraday) {
          setError("KR 인트라데이는 아직 미지원 — 하루/1달만 (미국은 IB로 분봉 지원)");
          setLoading(false); return;
        }
        const code = symbol.split(".")[0];
        const res = await getKRBars(code, tfId === "1M" ? 1800 : 730, ctrl.signal);
        if (res.bars.length === 0) throw new Error("빈 응답");
        setBars(res.bars.map(krBarToBarOut));
      } else if (isDaily) {
        // US 하루: 로컬 catalog 우선(빠름) → 없으면 IB 일봉
        try {
          const res = await getBars(symbol, oneYearAgo(), today(), undefined, ctrl.signal);
          if (res.bars.length > 0) { setBars(res.bars); return; }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
        const res = await getIBBars({ symbol: symbol.split(".")[0], asset_type: "stock", duration: "2 Y", bar_size: "1 day" }, ctrl.signal);
        if (res.bars.length === 0) throw new Error("빈 응답");
        setBars(res.bars.map(ibBarToBarOut));
      } else {
        // US 분봉/월봉: IB
        const res = await getIBBars({ symbol: symbol.split(".")[0], asset_type: "stock", duration: cfg.dur, bar_size: cfg.bar }, ctrl.signal);
        if (res.bars.length === 0) throw new Error("빈 응답 (IB 연결·구독 확인)");
        setBars(res.bars.map(ibBarToBarOut));
      }
    } catch (err2) {
      if (err2 instanceof DOMException && err2.name === "AbortError") return;
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      // 미국 분봉/월봉은 IB(TWS) 필요 — 연결 안 되면 친절히 안내
      if (!isDaily && venue !== "XKRX") {
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

  // Active indicators list for chips
  const activeIndicators = [
    showSma && { key: "sma", label: `SMA ${smaPeriod}`, onRemove: () => setShowSma(false) },
    showEma && { key: "ema", label: `EMA ${emaFast}/${emaSlow}`, onRemove: () => setShowEma(false) },
    showBB && { key: "bb", label: `BB ${bbPeriod}`, onRemove: () => setShowBB(false) },
    showRsi && { key: "rsi", label: `RSI ${rsiPeriod}`, onRemove: () => setShowRsi(false) },
    showMacd && { key: "macd", label: `MACD ${macdFast}/${macdSlow}/${macdSig}`, onRemove: () => setShowMacd(false) },
    showStoch && { key: "stoch", label: `Stoch ${stochK}/${stochD}`, onRemove: () => setShowStoch(false) },
    showCci && { key: "cci", label: `CCI ${cciPeriod}`, onRemove: () => setShowCci(false) },
    showWilliamsR && { key: "wr", label: `%R ${wrPeriod}`, onRemove: () => setShowWilliamsR(false) },
    showAdx && { key: "adx", label: `ADX ${adxPeriod}`, onRemove: () => setShowAdx(false) },
    showAtr && { key: "atr", label: `ATR ${atrPeriod}`, onRemove: () => setShowAtr(false) },
    showVolume && { key: "vol", label: "거래량", onRemove: () => setShowVolume(false) },
    showObv && { key: "obv", label: "OBV", onRemove: () => setShowObv(false) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Row 1: 타임프레임(바 간격) + 백테스트 */}
      <div className="flex items-center gap-1 flex-wrap">
        {TIMEFRAMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTf(t.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
              tf === t.id ? "border-accent text-accent bg-accent/10" : "border-border text-text-3 hover:text-accent hover:border-accent bg-panel-2"
            }`}
          >{t.label}</button>
        ))}
        <span className="text-border text-xs ml-1">|</span>
        <button
          onClick={() => {
            const params = new URLSearchParams({ instrument: symbol, start, end });
            if (showEma) {
              params.set("strategy", "ema_cross");
              params.set("fast", String(emaFast));
              params.set("slow", String(emaSlow));
            }
            router.push(`/backtest?${params.toString()}`);
          }}
          className="px-3 h-7 text-xs font-medium rounded border border-border text-text-2 hover:border-accent hover:text-accent bg-transparent cursor-pointer transition-colors"
          title="이 종목으로 백테스팅"
        >
          백테스트 →
        </button>
        {onAddToWatchlist && (
          <button
            onClick={() => onAddToWatchlist(symbol)}
            className={`px-3 h-7 text-xs font-medium rounded border cursor-pointer transition-colors ${
              isInWatchlist
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-2 hover:border-accent hover:text-accent bg-transparent"
            }`}
            title="워치리스트에 추가"
          >
            {isInWatchlist ? "★ 워치리스트" : "☆ 워치리스트"}
          </button>
        )}
        {!loading && bars.length > 0 && (
          <span className="text-text-3 text-xs font-data">{bars.length} bars</span>
        )}
      </div>

      {/* Row 2: Active indicator chips + panel toggle */}
      <div ref={panelRef} className="relative">
        <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
          {activeIndicators.map(ind => (
            <span
              key={ind.key}
              className="px-2 py-0.5 text-xs rounded border border-accent/40 text-accent bg-accent/5 flex items-center gap-1"
            >
              {ind.label}
              <button
                onClick={ind.onRemove}
                className="text-text-3 hover:text-neg cursor-pointer leading-none"
                aria-label={`Remove ${ind.label}`}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            onClick={() => setPanelOpen(o => !o)}
            className={`px-2.5 py-0.5 text-xs rounded border transition-colors cursor-pointer ${
              panelOpen
                ? "border-accent text-accent bg-accent/10"
                : "border-border text-text-3 hover:border-accent hover:text-accent"
            }`}
          >
            + 지표 추가
          </button>
        </div>

        {/* Collapsible indicator panel */}
        {panelOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-panel border border-border rounded-lg shadow-lg p-4 w-[480px] max-h-[440px] overflow-y-auto">
            {/* 오버레이 */}
            <div className="mb-4">
              <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">오버레이</p>
              <div className="flex flex-col gap-2">
                <IndicatorRow
                  checked={showSma}
                  onToggle={() => setShowSma(v => !v)}
                  label="SMA"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={smaPeriod} onChange={setSmaPeriod} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showEma}
                  onToggle={() => setShowEma(v => !v)}
                  label="EMA"
                >
                  <span className="text-text-3 text-xs">fast:</span>
                  <ParamInput value={emaFast} onChange={setEmaFast} />
                  <span className="text-text-3 text-xs">slow:</span>
                  <ParamInput value={emaSlow} onChange={setEmaSlow} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showBB}
                  onToggle={() => setShowBB(v => !v)}
                  label="볼린저밴드"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={bbPeriod} onChange={setBbPeriod} />
                  <span className="text-text-3 text-xs">std:</span>
                  <ParamInput value={bbStd} onChange={setBbStd} min={1} max={10} />
                </IndicatorRow>
              </div>
            </div>

            {/* 오실레이터 */}
            <div className="mb-4">
              <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">오실레이터</p>
              <div className="flex flex-col gap-2">
                <IndicatorRow
                  checked={showRsi}
                  onToggle={() => setShowRsi(v => !v)}
                  label="RSI"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={rsiPeriod} onChange={setRsiPeriod} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showMacd}
                  onToggle={() => setShowMacd(v => !v)}
                  label="MACD"
                >
                  <span className="text-text-3 text-xs">fast:</span>
                  <ParamInput value={macdFast} onChange={setMacdFast} />
                  <span className="text-text-3 text-xs">slow:</span>
                  <ParamInput value={macdSlow} onChange={setMacdSlow} />
                  <span className="text-text-3 text-xs">sig:</span>
                  <ParamInput value={macdSig} onChange={setMacdSig} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showStoch}
                  onToggle={() => setShowStoch(v => !v)}
                  label="스토캐스틱"
                >
                  <span className="text-text-3 text-xs">%K:</span>
                  <ParamInput value={stochK} onChange={setStochK} />
                  <span className="text-text-3 text-xs">%D:</span>
                  <ParamInput value={stochD} onChange={setStochD} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showCci}
                  onToggle={() => setShowCci(v => !v)}
                  label="CCI"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={cciPeriod} onChange={setCciPeriod} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showWilliamsR}
                  onToggle={() => setShowWilliamsR(v => !v)}
                  label="Williams %R"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={wrPeriod} onChange={setWrPeriod} />
                </IndicatorRow>
              </div>
            </div>

            {/* 추세 / 변동성 */}
            <div className="mb-4">
              <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">추세 / 변동성</p>
              <div className="flex flex-col gap-2">
                <IndicatorRow
                  checked={showAdx}
                  onToggle={() => setShowAdx(v => !v)}
                  label="ADX"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={adxPeriod} onChange={setAdxPeriod} />
                </IndicatorRow>
                <IndicatorRow
                  checked={showAtr}
                  onToggle={() => setShowAtr(v => !v)}
                  label="ATR"
                >
                  <span className="text-text-3 text-xs">period:</span>
                  <ParamInput value={atrPeriod} onChange={setAtrPeriod} />
                </IndicatorRow>
              </div>
            </div>

            {/* 거래량 */}
            <div>
              <p className="text-[10px] text-text-3 uppercase tracking-wider mb-2">거래량</p>
              <div className="flex flex-col gap-2">
                <IndicatorRow
                  checked={showVolume}
                  onToggle={() => setShowVolume(v => !v)}
                  label="거래량"
                />
                <IndicatorRow
                  checked={showObv}
                  onToggle={() => setShowObv(v => !v)}
                  label="OBV"
                />
              </div>
            </div>
          </div>
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
              emaFast={showEma ? emaFast : undefined}
              emaSlow={showEma ? emaSlow : undefined}
              sma={showSma ? smaPeriod : undefined}
              bollingerPeriod={showBB ? bbPeriod : undefined}
              bollingerStd={showBB ? bbStd : undefined}
            />
            {showRsi && <RSIChart bars={bars} period={rsiPeriod} />}
            {showMacd && <MACDChart bars={bars} fast={macdFast} slow={macdSlow} signal={macdSig} />}
            {showStoch && <StochasticChart bars={bars} kPeriod={stochK} dPeriod={stochD} />}
            {showCci && <CCIChart bars={bars} period={cciPeriod} />}
            {showWilliamsR && <WilliamsRChart bars={bars} period={wrPeriod} />}
            {showAdx && <ADXChart bars={bars} period={adxPeriod} />}
            {showAtr && <ATRChart bars={bars} period={atrPeriod} />}
            {showVolume && <VolumeChart bars={bars} />}
            {showObv && <OBVChart bars={bars} />}
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

interface IndicatorRowProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  children?: React.ReactNode;
}

function IndicatorRow({ checked, onToggle, label, children }: IndicatorRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-3.5 h-3.5 accent-accent cursor-pointer"
      />
      <span className={`text-xs w-28 shrink-0 ${checked ? "text-accent" : "text-text-2 group-hover:text-text-1"}`}>
        {label}
      </span>
      {children && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {children}
        </div>
      )}
    </label>
  );
}
