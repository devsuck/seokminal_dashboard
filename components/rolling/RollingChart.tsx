"use client";

import { useRef, useEffect } from "react";
import { createChart, LineSeries } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";
import type { RollingPoint } from "@/lib/rolling-analytics-utils";
import { TOKEN } from "@/lib/chart-colors";

export interface RollingSeries {
  label: string;
  color: string;
  points: RollingPoint[];
}

interface RollingChartProps {
  series: RollingSeries[];
  yFormat?: (v: number) => string;
  height?: number;
}

export function RollingChart({ series, height = 300, yFormat }: RollingChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height,
      layout: { background: { color: TOKEN.panel2 }, textColor: TOKEN.text3 },
      grid: { vertLines: { color: TOKEN.border }, horzLines: { color: TOKEN.border } },
      timeScale: { borderColor: TOKEN.border },
      rightPriceScale: { borderColor: TOKEN.border },
      localization: {
        priceFormatter: yFormat ?? ((v: number) => v.toFixed(2)),
      },
    });

    for (const s of series) {
      const lineSeries = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        title: s.label,
      });
      const data = s.points
        .filter((pt) => pt.value !== null)
        .map((pt) => ({
          time: Math.floor(pt.ts_ns / 1e9) as UTCTimestamp,
          value: pt.value as number,
        }));
      lineSeries.setData(data);
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [series, height]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
