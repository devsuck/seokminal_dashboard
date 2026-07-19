"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
import type { BarOut, TradeRecord } from "@/lib/api";
import type { ChartIndicatorSpec } from "@/lib/backtest-types";
import { TOKEN, categoricalColor } from "@/lib/chart-colors";

interface CandlestickChartProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  emaFast?: number;
  emaSlow?: number;
  sma?: number;
  bollingerPeriod?: number;
  bollingerStd?: number;
  /** 조건식에서 추출한 지표 스펙 — 오버레이(MA/BB/EMA)는 가격 페인,
      오실레이터(RSI/MACD/CCI/OBV)는 하단 서브페인에 렌더. */
  specs?: ChartIndicatorSpec[];
  /** CVD(누적 볼륨 델타) 서브페인 데이터 — 오더플로우 심볼에서만 전달됨. */
  cvdSeries?: { time: UTCTimestamp; value: number }[];
  /** 흡수(absorption) 캔들 — 우세 물량이 가격을 못 밀어낸 지점. 오더플로우 심볼에서만 전달됨. */
  absorptionMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[];
  /** 스탑런(stop-run) 캔들 — 최근 고점/저점 이탈 후 반전 마감. 오더플로우 심볼에서만 전달됨. */
  stopRunMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[];
  /** 델타 다이버전스 캔들 — 신고/신저가인데 캔들 델타가 반대 방향. 오더플로우 심볼에서만 전달됨. */
  divergenceMarkers?: { time: UTCTimestamp; side: "buy" | "sell" }[];
  /** VWAP + ±1σ/±2σ 밴드 — 가격 페인 오버레이. 오더플로우 심볼에서만 전달됨. */
  vwapSeries?: { time: UTCTimestamp; vwap: number; up1: number; dn1: number; up2: number; dn2: number }[];
  /** 캔들별 순델타(비누적) 히스토그램 서브페인 — 오더플로우 심볼에서만 전달됨. */
  deltaSeries?: { time: UTCTimestamp; value: number }[];
  /** 차트/캔들시리즈 생성 직후 호출 — 외부에서 series primitive를 attach하려는 소비자용.
      bars 등이 바뀌어 차트가 통째로 재생성될 때마다 다시 호출된다. */
  onSeriesReady?: (chart: IChartApi, series: ISeriesApi<"Candlestick">) => void;
  /** 차트 픽셀 높이. 기본 480. */
  height?: number;
  /** 우측 여백(바 개수). POC/VAH 등 price line 라벨이 최근 캔들과 겹치는 걸 막을 때 사용. 기본 0(라이브러리 기본값). */
  rightOffset?: number;
}

function computeSMA(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  return bars.map((b, i) => {
    if (i < period - 1) return null;
    const sum = bars.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0);
    return { time: Math.floor(b.ts_event / 1e9) as UTCTimestamp, value: sum / period };
  }).filter(Boolean) as { time: UTCTimestamp; value: number }[];
}

function computeBollingerBands(bars: BarOut[], period: number, stdMult: number) {
  const smaData = computeSMA(bars, period);
  return smaData.map((pt, i) => {
    const slice = bars.slice(i, i + period);
    const mean = pt.value;
    const variance = slice.reduce((s, b) => s + Math.pow(b.close - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    return {
      time: pt.time,
      upper: mean + stdMult * sd,
      middle: mean,
      lower: mean - stdMult * sd,
    };
  });
}

function computeEMA(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const result: { time: UTCTimestamp; value: number }[] = [];
  let ema = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  result.push({ time: Math.floor(bars[period - 1].ts_event / 1e9) as UTCTimestamp, value: ema });
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result.push({ time: Math.floor(bars[i].ts_event / 1e9) as UTCTimestamp, value: ema });
  }
  return result;
}

function barTime(b: BarOut): UTCTimestamp {
  return Math.floor(b.ts_event / 1e9) as UTCTimestamp;
}

function computeRSI(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length <= period) return [];
  const out: { time: UTCTimestamp; value: number }[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = bars[i].close - bars[i - 1].close;
    if (d >= 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  out.push({ time: barTime(bars[period]), value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < bars.length; i++) {
    const d = bars[i].close - bars[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out.push({ time: barTime(bars[i]), value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  }
  return out;
}

function computeMACD(bars: BarOut[], fast: number, slow: number, signalPeriod = 9): {
  macd: { time: UTCTimestamp; value: number }[];
  signal: { time: UTCTimestamp; value: number }[];
} {
  const fastE = computeEMA(bars, fast);
  const slowE = computeEMA(bars, slow);
  const slowByTime = new Map(slowE.map(p => [p.time, p.value]));
  const macd = fastE
    .filter(p => slowByTime.has(p.time))
    .map(p => ({ time: p.time, value: p.value - (slowByTime.get(p.time) as number) }));
  // signal = macd의 EMA
  const signal: { time: UTCTimestamp; value: number }[] = [];
  if (macd.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let ema = macd.slice(0, signalPeriod).reduce((s, p) => s + p.value, 0) / signalPeriod;
    signal.push({ time: macd[signalPeriod - 1].time, value: ema });
    for (let i = signalPeriod; i < macd.length; i++) {
      ema = macd[i].value * k + ema * (1 - k);
      signal.push({ time: macd[i].time, value: ema });
    }
  }
  return { macd, signal };
}

function computeCCI(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length < period) return [];
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const window = tp.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, v) => s + v, 0) / period;
    const meanDev = window.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    out.push({ time: barTime(bars[i]), value: meanDev === 0 ? 0 : (tp[i] - mean) / (0.015 * meanDev) });
  }
  return out;
}

function computeOBV(bars: BarOut[]): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  let obv = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i > 0) {
      if (bars[i].close > bars[i - 1].close) obv += bars[i].volume ?? 0;
      else if (bars[i].close < bars[i - 1].close) obv -= bars[i].volume ?? 0;
    }
    out.push({ time: barTime(bars[i]), value: obv });
  }
  return out;
}

export function CandlestickChart({ bars, trades = [], emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specs, cvdSeries, absorptionMarkers, stopRunMarkers, divergenceMarkers, vwapSeries, deltaSeries, onSeriesReady, height = 480, rightOffset = 0 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const cvdSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const specsKey = JSON.stringify(specs ?? []);

  // 차트/캔들시리즈는 마운트 시 한 번만 생성한다. bars가 폴링(예: 오더플로우 30초 갱신)으로
  // 바뀔 때마다 chart.remove()로 통째로 재생성하면 사용자가 확대한 줌이 매번 풀리는 문제가 있었다
  // — 아래 데이터 갱신 effect는 차트 자체를 건드리지 않으므로 줌 상태가 유지된다.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: TOKEN.panel2 },
        textColor: TOKEN.text3,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 13,
      },
      grid: {
        vertLines: { color: TOKEN.border },
        horzLines: { color: TOKEN.border },
      },
      crosshair: {
        vertLine: { color: TOKEN.accent, labelBackgroundColor: TOKEN.accent },
        horzLine: { color: TOKEN.accent, labelBackgroundColor: TOKEN.accent },
      },
      rightPriceScale: { borderColor: TOKEN.border },
      timeScale: { borderColor: TOKEN.border, timeVisible: true, rightOffset },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: TOKEN.pos,
      downColor: TOKEN.neg,
      borderUpColor: TOKEN.pos,
      borderDownColor: TOKEN.neg,
      wickUpColor: TOKEN.pos,
      wickDownColor: TOKEN.neg,
    });
    candleSeriesRef.current = candleSeries;

    onSeriesReady?.(chart, candleSeries);

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaySeriesRef.current = [];
      markersRef.current = null;
      cvdSeriesRef.current = null;
      deltaSeriesRef.current = null;
    };
    // onSeriesReady는 마운트 시 1회만 호출 — 의도적으로 deps 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // height는 뷰포트에 맞춰 호출부에서 동적으로 바뀔 수 있다 — 차트를 통째로 재생성하지 않고
  // applyOptions로만 갱신해 줌/스크롤 상태를 보존한다.
  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  // 데이터/지표 갱신 — 차트는 재생성하지 않고 시리즈 데이터만 교체한다.
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    candleSeries.setData(
      bars.map((b) => ({
        time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
    );

    for (const s of overlaySeriesRef.current) chart.removeSeries(s);
    overlaySeriesRef.current = [];

    const tradeMarkers: SeriesMarker<UTCTimestamp>[] = [];
    for (const t of trades) {
      if (t.entry_ts_ns) {
        tradeMarkers.push({
          time: Math.floor(t.entry_ts_ns / 1e9) as UTCTimestamp,
          position: "belowBar",
          color: TOKEN.pos,
          shape: "arrowUp",
          text: `BUY ${t.entry_price.toFixed(2)}`,
        });
      }
      if (t.exit_ts_ns && t.exit_price != null) {
        tradeMarkers.push({
          time: Math.floor(t.exit_ts_ns / 1e9) as UTCTimestamp,
          position: "aboveBar",
          color: TOKEN.neg,
          shape: "arrowDown",
          text: `SELL ${t.exit_price.toFixed(2)}`,
        });
      }
    }

    const absorptionMarkerList: SeriesMarker<UTCTimestamp>[] = (absorptionMarkers ?? []).map((m) => ({
      time: m.time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: TOKEN.info,
      shape: m.side === "buy" ? "arrowUp" : "arrowDown",
      text: "흡수",
    }));

    const stopRunMarkerList: SeriesMarker<UTCTimestamp>[] = (stopRunMarkers ?? []).map((m) => ({
      time: m.time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: TOKEN.accent,
      shape: "square",
      text: "스탑런",
    }));

    const divergenceMarkerList: SeriesMarker<UTCTimestamp>[] = (divergenceMarkers ?? []).map((m) => ({
      time: m.time,
      position: m.side === "buy" ? "belowBar" : "aboveBar",
      color: categoricalColor(0),
      shape: "circle",
      text: "다이버전스",
    }));

    const allMarkers = [...tradeMarkers, ...absorptionMarkerList, ...stopRunMarkerList, ...divergenceMarkerList].sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
    if (allMarkers.length > 0) {
      if (markersRef.current) markersRef.current.setMarkers(allMarkers);
      else markersRef.current = createSeriesMarkers(candleSeries, allMarkers);
    } else if (markersRef.current) {
      markersRef.current.setMarkers([]);
    }

    if (emaFast && emaFast > 0) {
      const fastData = computeEMA(bars, emaFast);
      if (fastData.length) {
        const s = chart.addSeries(LineSeries, { color: TOKEN.accent, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(fastData);
        overlaySeriesRef.current.push(s);
      }
    }
    if (emaSlow && emaSlow > 0) {
      const slowData = computeEMA(bars, emaSlow);
      if (slowData.length) {
        const s = chart.addSeries(LineSeries, { color: TOKEN.info, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(slowData);
        overlaySeriesRef.current.push(s);
      }
    }

    if (sma && sma > 0) {
      const smaData = computeSMA(bars, sma);
      if (smaData.length) {
        const s = chart.addSeries(LineSeries, { color: TOKEN.text2, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(smaData);
        overlaySeriesRef.current.push(s);
      }
    }

    if (bollingerPeriod && bollingerPeriod > 0 && bollingerStd && bollingerStd > 0) {
      const bbData = computeBollingerBands(bars, bollingerPeriod, bollingerStd);
      if (bbData.length) {
        const upperSeries = chart.addSeries(LineSeries, { color: TOKEN.text2, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        upperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        const middleSeries = chart.addSeries(LineSeries, { color: TOKEN.text2, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        middleSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
        const lowerSeries = chart.addSeries(LineSeries, { color: TOKEN.text2, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        lowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
        overlaySeriesRef.current.push(upperSeries, middleSeries, lowerSeries);
      }
    }

    // ── VWAP + σ밴드 오버레이 — 오더플로우 전용 ──
    if (vwapSeries && vwapSeries.length > 0) {
      const vwapLine = chart.addSeries(LineSeries, { color: TOKEN.warn, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      vwapLine.setData(vwapSeries.map((p) => ({ time: p.time, value: p.vwap })));
      overlaySeriesRef.current.push(vwapLine);
      const bandDefs: { pick: (p: NonNullable<typeof vwapSeries>[number]) => number }[] = [
        { pick: (p) => p.up1 }, { pick: (p) => p.dn1 }, { pick: (p) => p.up2 }, { pick: (p) => p.dn2 },
      ];
      for (const band of bandDefs) {
        const s = chart.addSeries(LineSeries, { color: TOKEN.text3, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(vwapSeries.map((p) => ({ time: p.time, value: band.pick(p) })));
        overlaySeriesRef.current.push(s);
      }
    }

    // ── 조건식 지표 스펙 렌더 — 오버레이는 가격 페인, 오실레이터는 서브페인 ──
    // 임의 개수의 지표 라인을 서로 구분하기 위한 색상은 categoricalColor()로 순환한다.
    let overlayCi = 0;
    let paneIdx = 1;
    const line = (data: { time: UTCTimestamp; value: number }[], color: string, pane = 0, dashed = false) => {
      if (!data.length) return null;
      const s = chart.addSeries(LineSeries, {
        color, lineWidth: 1, lineStyle: dashed ? 2 : 0,
        priceLineVisible: false, lastValueVisible: pane > 0,
      }, pane);
      s.setData(data);
      overlaySeriesRef.current.push(s);
      return s;
    };
    for (const spec of specs ?? []) {
      switch (spec.kind) {
        case "MA": {
          const data = spec.maType === "SIMPLE" ? computeSMA(bars, spec.period) : computeEMA(bars, spec.period);
          line(data, categoricalColor(overlayCi++));
          break;
        }
        case "EMA_CROSS": {
          line(computeEMA(bars, spec.fast), categoricalColor(overlayCi++));
          line(computeEMA(bars, spec.slow), categoricalColor(overlayCi++));
          break;
        }
        case "BB": {
          const bb = computeBollingerBands(bars, spec.period, spec.k);
          if (bb.length) {
            line(bb.map(d => ({ time: d.time, value: d.upper })), TOKEN.text2, 0, true);
            line(bb.map(d => ({ time: d.time, value: d.middle })), TOKEN.text2);
            line(bb.map(d => ({ time: d.time, value: d.lower })), TOKEN.text2, 0, true);
          }
          break;
        }
        case "RSI": {
          const s = line(computeRSI(bars, spec.period), categoricalColor(0), paneIdx++);
          if (s) {
            s.createPriceLine({ price: 70, color: TOKEN.text3, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "70" });
            s.createPriceLine({ price: 30, color: TOKEN.text3, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "30" });
          }
          break;
        }
        case "MACD": {
          const { macd, signal } = computeMACD(bars, spec.fast, spec.slow);
          const p = paneIdx++;
          const s = line(macd, TOKEN.info, p);
          line(signal, TOKEN.accent, p);
          if (s) s.createPriceLine({ price: 0, color: TOKEN.text3, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
          break;
        }
        case "CCI": {
          const s = line(computeCCI(bars, spec.period), categoricalColor(2), paneIdx++);
          if (s) {
            s.createPriceLine({ price: 100, color: TOKEN.text3, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "100" });
            s.createPriceLine({ price: -100, color: TOKEN.text3, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "-100" });
          }
          break;
        }
        case "OBV": {
          line(computeOBV(bars), TOKEN.warn, paneIdx++);
          break;
        }
      }
    }

    // ── CVD(누적 볼륨 델타) 서브페인 — 오더플로우 전용, specs 오실레이터 다음 페인 ──
    if (cvdSeriesRef.current) {
      chart.removeSeries(cvdSeriesRef.current);
      cvdSeriesRef.current = null;
    }
    if (cvdSeries && cvdSeries.length > 0) {
      const cvdPane = paneIdx++;
      const cvdSeriesApi = chart.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: true },
        cvdPane
      );
      let prevValue = 0;
      cvdSeriesApi.setData(
        cvdSeries.map((pt) => {
          const color = pt.value >= prevValue ? TOKEN.pos : TOKEN.neg;
          prevValue = pt.value;
          return { time: pt.time, value: pt.value, color };
        })
      );
      cvdSeriesRef.current = cvdSeriesApi;
    }

    // ── 캔들별 순델타(비누적) 히스토그램 서브페인 — 오더플로우 전용 ──
    if (deltaSeriesRef.current) {
      chart.removeSeries(deltaSeriesRef.current);
      deltaSeriesRef.current = null;
    }
    if (deltaSeries && deltaSeries.length > 0) {
      const deltaPane = paneIdx++;
      const deltaSeriesApi = chart.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: true },
        deltaPane
      );
      deltaSeriesApi.setData(
        deltaSeries.map((pt) => ({
          time: pt.time,
          value: pt.value,
          color: pt.value >= 0 ? TOKEN.pos : TOKEN.neg,
        }))
      );
      deltaSeriesRef.current = deltaSeriesApi;
    }

    // 서브페인이 생기면 가격 페인이 눌리지 않게 전체 높이 보정 — 서브페인이 늘어날수록(CVD+델타+
    // 조건식 오실레이터 등) 메인 캔들 페인이 상대적으로 더 눌리므로, 개수에 비례해 비율을 키운다.
    if (paneIdx > 1) {
      const panes = chart.panes();
      panes[0]?.setStretchFactor(Math.max(4, paneIdx));
      for (let i = 1; i < panes.length; i++) panes[i]?.setStretchFactor(1);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, trades, emaFast, emaSlow, sma, bollingerPeriod, bollingerStd, specsKey, cvdSeries, absorptionMarkers, stopRunMarkers, divergenceMarkers, vwapSeries, deltaSeries]);

  return <div ref={containerRef} className="w-full rounded-b-lg" />;
}
