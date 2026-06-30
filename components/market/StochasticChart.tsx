"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface StochasticChartProps {
  bars: BarOut[];
  kPeriod?: number;
  dPeriod?: number;
}

function computeStochastic(bars: BarOut[], kPeriod: number, dPeriod: number) {
  const kValues: { time: UTCTimestamp; value: number }[] = [];
  for (let i = kPeriod - 1; i < bars.length; i++) {
    const slice = bars.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(b => b.high));
    const low = Math.min(...slice.map(b => b.low));
    const k = high === low ? 50 : ((bars[i].close - low) / (high - low)) * 100;
    kValues.push({ time: Math.floor(bars[i].ts_event / 1e9) as UTCTimestamp, value: k });
  }
  const dValues = kValues.map((v, i) => {
    if (i < dPeriod - 1) return null;
    const avg = kValues.slice(i - dPeriod + 1, i + 1).reduce((s, x) => s + x.value, 0) / dPeriod;
    return { time: v.time, value: avg };
  }).filter(Boolean) as { time: UTCTimestamp; value: number }[];
  return { kValues, dValues };
}

export function StochasticChart({ bars, kPeriod = 14, dPeriod = 3 }: StochasticChartProps) {
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
    const { kValues, dValues } = computeStochastic(bars, kPeriod, dPeriod);
    const kSeries = chart.addSeries(LineSeries, { color: "#60A5FA", lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    kSeries.setData(kValues);
    const dSeries = chart.addSeries(LineSeries, { color: "#F97316", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    dSeries.setData(dValues);
    kSeries.createPriceLine({ price: 80, color: "#EF444440", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "80" });
    kSeries.createPriceLine({ price: 20, color: "#22C55E40", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "20" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, kPeriod, dPeriod]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">STOCH ({kPeriod}/{dPeriod})</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
