"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { BarOut } from "@/lib/api";
import { TOKEN } from "@/lib/chart-colors";

interface ADXChartProps {
  bars: BarOut[];
  period?: number;
}

function computeADX(bars: BarOut[], period: number) {
  if (bars.length < period + 1) return { adx: [], diPlus: [], diMinus: [] };

  const trArr: number[] = [];
  const dmPlusArr: number[] = [];
  const dmMinusArr: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = bars[i - 1].high;
    const prevLow = bars[i - 1].low;
    const prevClose = bars[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    const dmPlus = upMove > downMove && upMove > 0 ? upMove : 0;
    const dmMinus = downMove > upMove && downMove > 0 ? downMove : 0;
    trArr.push(tr);
    dmPlusArr.push(dmPlus);
    dmMinusArr.push(dmMinus);
  }

  // Wilder's smoothing: first value is sum of first `period` values
  let smTR = trArr.slice(0, period).reduce((s, v) => s + v, 0);
  let smDMPlus = dmPlusArr.slice(0, period).reduce((s, v) => s + v, 0);
  let smDMMinus = dmMinusArr.slice(0, period).reduce((s, v) => s + v, 0);

  const diPlus: { time: UTCTimestamp; value: number }[] = [];
  const diMinus: { time: UTCTimestamp; value: number }[] = [];
  const dxArr: number[] = [];

  function pushDI(idx: number) {
    const barIdx = idx + period; // bars index (bars[0] has no DM, so DM[0]=bars[1])
    const time = Math.floor(bars[barIdx].ts_event / 1e9) as UTCTimestamp;
    const dp = smTR === 0 ? 0 : (smDMPlus / smTR) * 100;
    const dm = smTR === 0 ? 0 : (smDMMinus / smTR) * 100;
    diPlus.push({ time, value: dp });
    diMinus.push({ time, value: dm });
    const diSum = dp + dm;
    const dx = diSum === 0 ? 0 : (Math.abs(dp - dm) / diSum) * 100;
    dxArr.push(dx);
  }

  pushDI(0);

  for (let i = period; i < trArr.length; i++) {
    smTR = smTR - smTR / period + trArr[i];
    smDMPlus = smDMPlus - smDMPlus / period + dmPlusArr[i];
    smDMMinus = smDMMinus - smDMMinus / period + dmMinusArr[i];
    pushDI(i - period + 1);
  }

  // ADX = Wilder smoothing of DX over `period`
  const adx: { time: UTCTimestamp; value: number }[] = [];
  if (dxArr.length < period) return { adx, diPlus, diMinus };

  let adxVal = dxArr.slice(0, period).reduce((s, v) => s + v, 0) / period;
  // ADX at position (period-1) of dxArr, which corresponds to diPlus[period-1]
  adx.push({ time: diPlus[period - 1].time, value: adxVal });
  for (let i = period; i < dxArr.length; i++) {
    adxVal = (adxVal * (period - 1) + dxArr[i]) / period;
    adx.push({ time: diPlus[i].time, value: adxVal });
  }

  return { adx, diPlus, diMinus };
}

export function ADXChart({ bars, period = 14 }: ADXChartProps) {
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
    const { adx, diPlus, diMinus } = computeADX(bars, period);
    const adxSeries = chart.addSeries(LineSeries, { color: TOKEN.text1, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    adxSeries.setData(adx);
    const diPlusSeries = chart.addSeries(LineSeries, { color: TOKEN.pos, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    diPlusSeries.setData(diPlus);
    const diMinusSeries = chart.addSeries(LineSeries, { color: TOKEN.neg, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    diMinusSeries.setData(diMinus);
    adxSeries.createPriceLine({ price: 25, color: `${TOKEN.border}40`, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "25" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, period]);

  return (
    <div className="border-t border-border bg-panel">
      <div className="px-4 py-1 flex items-center gap-2">
        <span className="text-[10px] text-text-3 uppercase tracking-wider">ADX ({period})</span>
      </div>
      <div ref={ref} style={{ height: "100px" }} className="w-full" />
    </div>
  );
}
