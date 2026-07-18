"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BarOut } from "@/lib/api";
import { TOKEN, CATEGORICAL } from "@/lib/chart-colors";

// 여러 심볼을 나란히 비교하는 차트이므로 색상은 의미(양/음 등)가 아니라 시리즈 구분용 —
// CATEGORICAL 팔레트에서 가져온다. bgClass는 범례용 Tailwind arbitrary-value 등가물이며
// Tailwind가 정적 클래스명을 필요로 하므로 CATEGORICAL 값과 동일한 리터럴로 수동 동기화한다.
export const SERIES_CONFIG = [
  { color: CATEGORICAL[0], bgClass: "bg-[#A855F7]" },
  { color: CATEGORICAL[1], bgClass: "bg-[#EC4899]" },
  { color: CATEGORICAL[2], bgClass: "bg-[#14B8A6]" },
  { color: CATEGORICAL[3], bgClass: "bg-[#F97316]" },
  { color: CATEGORICAL[4], bgClass: "bg-[#3B82F6]" },
  { color: CATEGORICAL[5], bgClass: "bg-[#06B6D4]" },
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
        background: { color: TOKEN.panel2 },
        textColor: TOKEN.text3,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 11,
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
      timeScale: { borderColor: TOKEN.border, timeVisible: true },
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
