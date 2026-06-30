"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";

interface RSIChartProps {
  bars: BarOut[];
  period?: number;
}

function computeRSI(bars: BarOut[], period: number): { time: UTCTimestamp; value: number }[] {
  if (bars.length < period + 1) return [];
  const result: { time: UTCTimestamp; value: number }[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = bars[i].close - bars[i - 1].close;
    if (delta > 0) avgGain += delta; else avgLoss -= delta;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period; i < bars.length; i++) {
    if (i > period) {
      const delta = bars[i].close - bars[i - 1].close;
      const gain = delta > 0 ? delta : 0;
      const loss = delta < 0 ? -delta : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: Math.floor(bars[i].ts_event / 1e9) as UTCTimestamp, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

export function RSIChart({ bars, period = 14 }: RSIChartProps) {
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
    const data = computeRSI(bars, period);
    const series = chart.addSeries(LineSeries, { color: "#A78BFA", lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    series.setData(data);
    series.createPriceLine({ price: 70, color: "#EF444440", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
    series.createPriceLine({ price: 30, color: "#22C55E40", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, period]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">RSI ({period})</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
