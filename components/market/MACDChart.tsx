"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, HistogramSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";
import { TOKEN } from "@/lib/chart-colors";

interface MACDChartProps {
  bars: BarOut[];
  fast?: number;
  slow?: number;
  signal?: number;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let e = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result.push(...new Array(period - 1).fill(NaN));
  result.push(e);
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    result.push(e);
  }
  return result;
}

function computeMACD(bars: BarOut[], fast: number, slow: number, sig: number) {
  const closes = bars.map(b => b.close);
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => (isNaN(v) || isNaN(emaSlow[i])) ? NaN : v - emaSlow[i]);
  const validMacd = macdLine.filter(v => !isNaN(v));
  const sigLine = ema(validMacd, sig);
  const startIdx = slow - 1;
  const sigStart = startIdx + sig - 1;
  return bars.map((b, i) => {
    const time = Math.floor(b.ts_event / 1e9) as UTCTimestamp;
    const macd = i >= startIdx ? macdLine[i] : NaN;
    const si = i >= sigStart ? sigLine[i - sigStart] : NaN;
    const hist = (!isNaN(macd) && !isNaN(si)) ? macd - si : NaN;
    return { time, macd, signal: si, hist };
  }).filter(d => !isNaN(d.macd));
}

export function MACDChart({ bars, fast = 12, slow = 26, signal = 9 }: MACDChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 100,
      layout: { background: { color: TOKEN.panel2 }, textColor: TOKEN.text3, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: TOKEN.border }, horzLines: { color: TOKEN.border } },
      rightPriceScale: { borderColor: TOKEN.border, scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: { borderColor: TOKEN.border, timeVisible: true },
    });
    const data = computeMACD(bars, fast, slow, signal);
    const macdSeries = chart.addSeries(LineSeries, { color: TOKEN.info, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    macdSeries.setData(data.map(d => ({ time: d.time, value: d.macd })));
    const sigSeries = chart.addSeries(LineSeries, { color: TOKEN.accent, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    sigSeries.setData(data.filter(d => !isNaN(d.signal)).map(d => ({ time: d.time, value: d.signal })));
    const histSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
    histSeries.setData(data.filter(d => !isNaN(d.hist)).map(d => ({ time: d.time, value: d.hist, color: d.hist >= 0 ? `${TOKEN.pos}60` : `${TOKEN.neg}60` })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, fast, slow, signal]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">MACD ({fast},{slow},{signal})</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
