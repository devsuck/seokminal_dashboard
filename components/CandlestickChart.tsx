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

export function CandlestickChart({ bars, trades = [], emaFast, emaSlow }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { color: "#0d0d0d" },
        textColor: "#666",
        fontFamily: "'Courier New', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: {
        vertLine: { color: "#ff8c00", labelBackgroundColor: "#ff8c00" },
        horzLine: { color: "#ff8c00", labelBackgroundColor: "#ff8c00" },
      },
      rightPriceScale: { borderColor: "#2a2a2a" },
      timeScale: { borderColor: "#2a2a2a", timeVisible: true },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00cc44",
      downColor: "#ff3333",
      borderUpColor: "#00cc44",
      borderDownColor: "#ff3333",
      wickUpColor: "#00cc44",
      wickDownColor: "#ff3333",
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
            color: "#00cc44",
            shape: "arrowUp",
            text: `BUY ${t.entry_price.toFixed(2)}`,
          });
        }
        if (t.exit_ts_ns && t.exit_price != null) {
          markers.push({
            time: Math.floor(t.exit_ts_ns / 1e9) as UTCTimestamp,
            position: "aboveBar",
            color: "#ff3333",
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
        const s = chart.addSeries(LineSeries, { color: "#ff8c00", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(fastData);
      }
    }
    if (emaSlow && emaSlow > 0) {
      const slowData = computeEMA(bars, emaSlow);
      if (slowData.length) {
        const s = chart.addSeries(LineSeries, { color: "#4488ff", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(slowData);
      }
    }

    return () => { chart.remove(); chartRef.current = null; };
  }, [bars, trades, emaFast, emaSlow]);

  return <div ref={containerRef} style={{ width: "100%", border: "1px solid #2a2a2a" }} />;
}
