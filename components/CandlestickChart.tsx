"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface CandlestickChartProps {
  bars: BarOut[];
}

export function CandlestickChart({ bars }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries);
    series.setData(
      bars.map((bar) => ({
        time: Math.floor(bar.ts_event / 1_000_000_000) as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
    );

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={containerRef} className="w-full" />;
}
