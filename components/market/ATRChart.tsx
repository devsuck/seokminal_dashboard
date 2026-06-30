"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface ATRChartProps {
  bars: BarOut[];
  period?: number;
}

function computeATR(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length < period) return [];
  const trs = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prev = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
  const result: { time: UTCTimestamp; value: number }[] = [];
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result.push({ time: Math.floor(bars[period - 1].ts_event / 1e9) as UTCTimestamp, value: atr });
  for (let i = period; i < bars.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push({ time: Math.floor(bars[i].ts_event / 1e9) as UTCTimestamp, value: atr });
  }
  return result;
}

export function ATRChart({ bars, period = 14 }: ATRChartProps) {
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
    const data = computeATR(bars, period);
    const series = chart.addSeries(LineSeries, { color: "#F59E0B", lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    series.setData(data);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, period]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">ATR ({period})</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
