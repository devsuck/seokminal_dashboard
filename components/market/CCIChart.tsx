"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface CCIChartProps {
  bars: BarOut[];
  period?: number;
}

function computeCCI(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length < period) return [];
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const tps = slice.map(b => (b.high + b.low + b.close) / 3);
    const tp = tps[tps.length - 1];
    const smaTP = tps.reduce((s, v) => s + v, 0) / period;
    const meanDev = tps.reduce((s, v) => s + Math.abs(v - smaTP), 0) / period;
    const cci = meanDev === 0 ? 0 : (tp - smaTP) / (0.015 * meanDev);
    result.push({ time: Math.floor(bars[i].ts_event / 1e9) as UTCTimestamp, value: cci });
  }
  return result;
}

export function CCIChart({ bars, period = 20 }: CCIChartProps) {
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
    const data = computeCCI(bars, period);
    const series = chart.addSeries(LineSeries, { color: "#34D399", lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    series.setData(data);
    series.createPriceLine({ price: 100, color: "#EF444440", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "+100" });
    series.createPriceLine({ price: -100, color: "#22C55E40", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "-100" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, period]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">CCI ({period})</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
