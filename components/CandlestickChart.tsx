"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
  type SeriesMarker,
} from "lightweight-charts";
import type { BarOut, TradeRecord } from "@/lib/api";

interface CandlestickChartProps {
  bars: BarOut[];
  trades?: TradeRecord[];
  emaFast?: number;
  emaSlow?: number;
  sma?: number;
  bollingerPeriod?: number;
  bollingerStd?: number;
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

export function CandlestickChart({ bars, trades = [], emaFast, emaSlow, sma, bollingerPeriod, bollingerStd }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 480,
      layout: {
        background: { color: "#0F131A" },
        textColor: "#5F6B7A",
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#151A23" },
        horzLines: { color: "#151A23" },
      },
      crosshair: {
        vertLine: { color: "#FF9F1C", labelBackgroundColor: "#FF9F1C" },
        horzLine: { color: "#FF9F1C", labelBackgroundColor: "#FF9F1C" },
      },
      rightPriceScale: { borderColor: "#242A35" },
      timeScale: { borderColor: "#242A35", timeVisible: true },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    candleSeries.setData(
      bars.map((b) => ({
        time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
        open: b.open, high: b.high, low: b.low, close: b.close,
      }))
    );

    if (trades.length > 0) {
      const markers: SeriesMarker<UTCTimestamp>[] = [];
      for (const t of trades) {
        if (t.entry_ts_ns) {
          markers.push({
            time: Math.floor(t.entry_ts_ns / 1e9) as UTCTimestamp,
            position: "belowBar",
            color: "#22C55E",
            shape: "arrowUp",
            text: `BUY ${t.entry_price.toFixed(2)}`,
          });
        }
        if (t.exit_ts_ns && t.exit_price != null) {
          markers.push({
            time: Math.floor(t.exit_ts_ns / 1e9) as UTCTimestamp,
            position: "aboveBar",
            color: "#EF4444",
            shape: "arrowDown",
            text: `SELL ${t.exit_price.toFixed(2)}`,
          });
        }
      }
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    if (emaFast && emaFast > 0) {
      const fastData = computeEMA(bars, emaFast);
      if (fastData.length) {
        const s = chart.addSeries(LineSeries, { color: "#FF9F1C", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(fastData);
      }
    }
    if (emaSlow && emaSlow > 0) {
      const slowData = computeEMA(bars, emaSlow);
      if (slowData.length) {
        const s = chart.addSeries(LineSeries, { color: "#3B82F6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(slowData);
      }
    }

    if (sma && sma > 0) {
      const smaData = computeSMA(bars, sma);
      if (smaData.length) {
        const s = chart.addSeries(LineSeries, { color: "#94A3B8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(smaData);
      }
    }

    if (bollingerPeriod && bollingerPeriod > 0 && bollingerStd && bollingerStd > 0) {
      const bbData = computeBollingerBands(bars, bollingerPeriod, bollingerStd);
      if (bbData.length) {
        const upperSeries = chart.addSeries(LineSeries, { color: "#94A3B8", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        upperSeries.setData(bbData.map(d => ({ time: d.time, value: d.upper })));
        const middleSeries = chart.addSeries(LineSeries, { color: "#94A3B8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        middleSeries.setData(bbData.map(d => ({ time: d.time, value: d.middle })));
        const lowerSeries = chart.addSeries(LineSeries, { color: "#94A3B8", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        lowerSeries.setData(bbData.map(d => ({ time: d.time, value: d.lower })));
      }
    }

    return () => { chart.remove(); chartRef.current = null; };
  }, [bars, trades, emaFast, emaSlow, sma, bollingerPeriod, bollingerStd]);

  return <div ref={containerRef} className="w-full rounded-b-lg" />;
}
