"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getOptionsGex, type GexSnapshot } from "@/lib/api";
import { useOptionsFlowSocket } from "@/hooks/useOptionsFlowSocket";

const POLL_INTERVAL_MS = 60_000;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 48 };

interface OptionsFlowPanelProps {
  currency: string; // "BTC" | "ETH"
}

function GexChart({ snapshot, width = 560, height = 220 }: { snapshot: GexSnapshot; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll("*").remove();
    if (snapshot.levels.length === 0) return;

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    const strikes = snapshot.levels.map((lv) => lv.strike.toString());
    const xScale = d3.scaleBand<string>().domain(strikes).range([0, innerW]).padding(0.2);

    const maxAbs = Math.max(1, ...snapshot.levels.map((lv) => Math.abs(lv.net_gex)));
    const yScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([innerH, 0]);

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(0)).attr("y2", yScale(0))
      .attr("stroke", "var(--color-border)").attr("stroke-width", 1);

    g.selectAll("rect")
      .data(snapshot.levels)
      .join("rect")
      .attr("x", (lv) => xScale(lv.strike.toString()) ?? 0)
      .attr("width", xScale.bandwidth())
      .attr("y", (lv) => yScale(Math.max(0, lv.net_gex)))
      .attr("height", (lv) => Math.abs(yScale(lv.net_gex) - yScale(0)))
      .attr("fill", (lv) => (lv.net_gex >= 0 ? "var(--color-pos)" : "var(--color-neg)"));

    if (snapshot.spot > 0 && snapshot.levels.length > 0) {
      const nearestStrike = snapshot.levels.reduce((best, lv) =>
        Math.abs(lv.strike - snapshot.spot) < Math.abs(best.strike - snapshot.spot) ? lv : best
      );
      const spotX = (xScale(nearestStrike.strike.toString()) ?? 0) + xScale.bandwidth() / 2;
      g.append("line")
        .attr("x1", spotX).attr("x2", spotX)
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "var(--color-accent)").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");
    }

    const tickEvery = Math.max(1, Math.ceil(strikes.length / 8));
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickValues(xScale.domain().filter((_, i) => i % tickEvery === 0)))
      .call((gg) => gg.select(".domain").attr("stroke", "var(--color-border)"))
      .call((gg) => gg.selectAll("text").attr("fill", "var(--color-text-2)").attr("font-size", "10px"))
      .call((gg) => gg.selectAll("line").attr("stroke", "var(--color-border)"));

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(4))
      .call((gg) => gg.select(".domain").attr("stroke", "var(--color-border)"))
      .call((gg) => gg.selectAll("text").attr("fill", "var(--color-text-2)").attr("font-size", "10px"))
      .call((gg) => gg.selectAll("line").attr("stroke", "var(--color-border)"));
  }, [snapshot, width, height]);

  return <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" />;
}

export function OptionsFlowPanel({ currency }: OptionsFlowPanelProps) {
  const [gex, setGex] = useState<GexSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { trades, connectionState } = useOptionsFlowSocket(currency);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      getOptionsGex(currency, ctrl.signal)
        .then((snapshot) => {
          if (!cancelled) setGex(snapshot);
        })
        .catch(() => {
          // 일시적 폴링 실패는 조용히 무시 — 마지막 캐시값(gex)을 그대로 유지한다.
          // (백엔드 orderflow/gex.py의 _cache가 upstream 실패 시 마지막 값을 보존하는 것과 동일한 동작)
        });
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [currency]);

  const isStale = gex != null && Date.now() - gex.updated_at * 1000 > 5 * 60_000;

  return (
    <div className="rounded-lg border border-border bg-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-1 text-sm font-medium">{currency} 옵션 GEX</h3>
        <span className="text-text-3 text-xs">
          {gex ? `spot ${gex.spot.toLocaleString()}` : "로딩 중"}
          {isStale && <span className="text-warn"> · 데이터 지연</span>}
        </span>
      </div>
      {gex && gex.levels.length > 0 ? (
        <GexChart snapshot={gex} />
      ) : (
        <div className="text-text-3 text-xs py-8 text-center">GEX 데이터 없음</div>
      )}

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-text-2 text-xs">옵션 체결</h4>
          <span className="text-text-3 text-xs">{connectionState}</span>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {trades.length === 0 && <div className="text-text-3 text-xs">체결 대기 중</div>}
          {trades.map((t, i) => (
            <div key={`${t.instrument_name}-${t.timestamp}-${i}`} className="flex items-center justify-between text-xs">
              <span className="text-text-2">{t.instrument_name}</span>
              <span className={t.direction === "buy" ? "text-pos" : "text-neg"}>
                {t.direction === "buy" ? "매수" : "매도"} {t.amount}
              </span>
              <span className="text-text-3">IV {t.iv.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
