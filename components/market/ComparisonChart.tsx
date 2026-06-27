"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BarOut } from "@/lib/api";

// Hex values match design tokens; bgClass is the Tailwind equivalent for legend use
export const SERIES_CONFIG = [
  { color: "#3B82F6", bgClass: "bg-info" },
  { color: "#22C55E", bgClass: "bg-pos" },
  { color: "#F59E0B", bgClass: "bg-warn" },
  { color: "#EF4444", bgClass: "bg-neg" },
  { color: "#8B5CF6", bgClass: "bg-[#8B5CF6]" },
  { color: "#06B6D4", bgClass: "bg-[#06B6D4]" },
] as const;

interface ComparisonChartProps {
  data: Record<string, BarOut[]>;
  symbols: string[];
}

function normalize(bars: BarOut[]): { time: UTCTimestamp; value: number }[] {
  if (bars.length === 0) return [];
  const base = bars[0].close;
  return bars.map(b => ({
    time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
    value: ((b.close - base) / base) * 100,
  }));
}

export function ComparisonChart({ data, symbols }: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || symbols.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
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

    symbols.forEach((symbol, i) => {
      const bars = data[symbol];
      if (!bars || bars.length === 0) return;
      const cfg = SERIES_CONFIG[i % SERIES_CONFIG.length];
      const series = chart.addSeries(LineSeries, {
        color: cfg.color,
        lineWidth: 2,
        priceLineVisible: false,
        title: symbol.split(".")[0],
      });
      series.setData(normalize(bars));
    });

    chart.timeScale().fitContent();

    return () => { chart.remove(); chartRef.current = null; };
  }, [data, symbols]);

  return <div ref={containerRef} className="w-full rounded-b-lg" />;
}
