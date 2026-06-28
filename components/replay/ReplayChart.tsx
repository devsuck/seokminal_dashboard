"use client";

import { useRef, useEffect } from "react";
import { createChart, CandlestickSeries, createSeriesMarkers } from "lightweight-charts";
import type { UTCTimestamp, SeriesMarker } from "lightweight-charts";
import type { TradeRecord, BarOut } from "@/lib/api";

interface ReplayChartProps {
  bars: BarOut[];
  trades: TradeRecord[];
  currentIndex: number;
  height?: number;
}

export function ReplayChart({ bars, trades, currentIndex, height = 360 }: ReplayChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height,
      layout: { background: { color: "#0F131A" }, textColor: "#6B7280" },
      grid: { vertLines: { color: "#1E2530" }, horzLines: { color: "#1E2530" } },
      timeScale: { borderColor: "#374151" },
      rightPriceScale: { borderColor: "#374151" },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    const candles = bars.map(b => ({
      time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    series.setData(candles);

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    const limit = Math.min(currentIndex, trades.length - 1);
    for (let i = 0; i <= limit; i++) {
      const trade = trades[i];
      const isLong = trade.side === "LONG" || trade.side === "BUY";
      markers.push({
        time: Math.floor(trade.entry_ts_ns / 1e9) as UTCTimestamp,
        position: isLong ? "belowBar" : "aboveBar",
        shape: isLong ? "arrowUp" : "arrowDown",
        color: isLong ? "#22C55E" : "#EF4444",
        text: "E",
      });
      if (trade.exit_ts_ns !== null) {
        const exitWin = trade.pnl !== null && trade.pnl > 0;
        markers.push({
          time: Math.floor(trade.exit_ts_ns / 1e9) as UTCTimestamp,
          position: "aboveBar",
          shape: "circle",
          color: exitWin ? "#22C55E" : "#EF4444",
          text: "X",
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    if (markers.length > 0) createSeriesMarkers(series, markers);

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, trades, currentIndex, height]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
