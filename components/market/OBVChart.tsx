"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface OBVChartProps {
  bars: BarOut[];
}

function computeOBV(bars: BarOut[]): { time: UTCTimestamp; value: number }[] {
  let obv = 0;
  return bars.map((b, i) => {
    if (i > 0) {
      if (b.close > bars[i - 1].close) obv += b.volume;
      else if (b.close < bars[i - 1].close) obv -= b.volume;
    }
    return { time: Math.floor(b.ts_event / 1e9) as UTCTimestamp, value: obv };
  });
}

export function OBVChart({ bars }: OBVChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 100,
      layout: { background: { color: "#0F131A" }, textColor: "#5F6B7A", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: "#151A23" }, horzLines: { color: "#151A23" } },
      rightPriceScale: { borderColor: "#242A35", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: "#242A35", timeVisible: true },
    });
    const data = computeOBV(bars);
    const series = chart.addSeries(LineSeries, { color: "#818CF8", lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    series.setData(data);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">OBV</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
