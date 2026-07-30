"use client";

import { useEffect, useRef } from "react";
import { createChart, HistogramSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";
import { TOKEN } from "@/lib/chart-colors";

interface VolumeChartProps {
  bars: BarOut[];
}

export function VolumeChart({ bars }: VolumeChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 100,
      layout: { background: { color: TOKEN.panel2 }, textColor: TOKEN.text3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: TOKEN.border }, horzLines: { color: TOKEN.border } },
      rightPriceScale: { borderColor: TOKEN.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: TOKEN.border, timeVisible: true },
    });
    const histSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: true });
    histSeries.setData(bars.map(b => ({
      time: Math.floor(b.ts_event / 1e9) as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open ? `${TOKEN.pos}60` : `${TOKEN.neg}60`,
    })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">거래량</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
