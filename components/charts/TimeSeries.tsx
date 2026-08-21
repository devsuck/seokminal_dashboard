"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";
import { TOKEN } from "@/lib/chart-colors";

export interface TSPoint { time: number; value: number } // time = epoch seconds
export interface TSSeries { label: string; color: string; points: TSPoint[] }

/** 다계열 시계열 라인(lightweight-charts v5). RollingChart 패턴 그대로, 재사용 프리미티브.
 *  크로스헤어+툴팁 기본(라이브러리 내장). 컨테이너 height는 CLAUDE.md 허용 예외. */
export function TimeSeries({ series, height = 220, yFormat }: {
  series: TSSeries[];
  height?: number;
  yFormat?: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height,
      layout: { background: { color: TOKEN.panel2 }, textColor: TOKEN.text3 },
      grid: { vertLines: { color: TOKEN.border }, horzLines: { color: TOKEN.border } },
      timeScale: { borderColor: TOKEN.border, timeVisible: true },
      // bottom 여백 = 좌하단 라이브러리 로고와 라인 겹침 방지
      rightPriceScale: { borderColor: TOKEN.border, scaleMargins: { top: 0.1, bottom: 0.18 } },
      localization: { priceFormatter: yFormat ?? ((v: number) => v.toFixed(2)) },
    });

    for (const s of series) {
      const line = chart.addSeries(LineSeries, { color: s.color, lineWidth: 2, title: s.label });
      const sorted = [...s.points].sort((a, b) => a.time - b.time);
      const deduped: { time: UTCTimestamp; value: number }[] = [];
      for (const p of sorted) {
        const time = Math.floor(p.time) as UTCTimestamp;
        if (deduped.length > 0 && deduped[deduped.length - 1].time === time) {
          deduped[deduped.length - 1] = { time, value: p.value };
        } else {
          deduped.push({ time, value: p.value });
        }
      }
      line.setData(deduped);
    }
    chart.timeScale().fitContent();

    const onResize = () => { if (ref.current) chart.applyOptions({ width: ref.current.clientWidth }); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.remove(); };
  }, [series, height, yFormat]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
