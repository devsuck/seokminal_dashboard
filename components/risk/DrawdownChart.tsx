"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { TimeSeriesPoint } from "@/lib/api";

interface DrawdownChartProps {
  points: TimeSeriesPoint[];
  height?: number;
}

export function DrawdownChart({ points, height = 320 }: DrawdownChartProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || points.length < 2) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const W = ref.current.clientWidth || 640;
    const topH = Math.floor(height * 0.62);
    const botH = height - topH;
    const ml = 52, mr = 16, mt = 8, mb = 24;
    const innerW = W - ml - mr;

    const dates = points.map((p) => new Date(p.ts_ns / 1_000_000));
    const xScale = d3.scaleTime()
      .domain([dates[0], dates[dates.length - 1]])
      .range([0, innerW]);

    // ── Top panel: cumulative return ──────────────────────────────────
    const cumVals = points.map((p) => p.cumulative_return);
    const benchVals = points
      .filter((p) => p.benchmark_cumulative !== null)
      .map((p) => p.benchmark_cumulative as number);
    const allYVals = [...cumVals, ...benchVals];
    const yRet = d3
      .scaleLinear()
      .domain([
        Math.min(0, d3.min(allYVals) ?? 0) * 1.1,
        (d3.max(allYVals) ?? 0.01) * 1.1 || 0.01,
      ])
      .range([topH - mb, mt]);

    const g1 = svg.append("g").attr("transform", `translate(${ml},0)`);

    g1.append("g")
      .call(
        d3.axisLeft(yRet)
          .ticks(4)
          .tickFormat((v) => `${((v as number) * 100).toFixed(0)}%`)
          .tickSize(-innerW),
      )
      .call((g) => {
        g.selectAll(".domain").remove();
        g.selectAll(".tick line").attr("stroke", "#1E2530");
        g.selectAll(".tick text").attr("fill", "#6B7280").attr("font-size", "10");
      });

    // Zero line
    g1.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yRet(0)).attr("y2", yRet(0))
      .attr("stroke", "#374151").attr("stroke-width", 1);

    // Benchmark line
    const benchPoints = points.filter((p) => p.benchmark_cumulative !== null);
    if (benchPoints.length > 1) {
      const benchDates = benchPoints.map((p) => new Date(p.ts_ns / 1_000_000));
      const benchLine = d3
        .line<TimeSeriesPoint>()
        .x((_, i) => xScale(benchDates[i]))
        .y((p) => yRet(p.benchmark_cumulative as number));
      g1.append("path")
        .datum(benchPoints)
        .attr("fill", "none")
        .attr("stroke", "#4B5563")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,2")
        .attr("d", benchLine);
    }

    // Instrument cumulative return line
    const cumLine = d3
      .line<TimeSeriesPoint>()
      .x((_, i) => xScale(dates[i]))
      .y((p) => yRet(p.cumulative_return));
    g1.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", "#FF9F1C")
      .attr("stroke-width", 1.5)
      .attr("d", cumLine);

    // ── Bottom panel: drawdown ────────────────────────────────────────
    const minDD = d3.min(points, (p) => p.drawdown) ?? -0.01;
    const yDD = d3
      .scaleLinear()
      .domain([minDD * 1.1 || -0.01, 0])
      .range([botH - mb, mt]);

    const g2 = svg.append("g").attr("transform", `translate(${ml},${topH})`);

    g2.append("g")
      .call(
        d3.axisLeft(yDD)
          .ticks(3)
          .tickFormat((v) => `${((v as number) * 100).toFixed(0)}%`)
          .tickSize(-innerW),
      )
      .call((g) => {
        g.selectAll(".domain").remove();
        g.selectAll(".tick line").attr("stroke", "#1E2530");
        g.selectAll(".tick text").attr("fill", "#6B7280").attr("font-size", "10");
      });

    const ddArea = d3
      .area<TimeSeriesPoint>()
      .x((_, i) => xScale(dates[i]))
      .y0(yDD(0))
      .y1((p) => yDD(p.drawdown));
    g2.append("path")
      .datum(points)
      .attr("fill", "rgba(239,68,68,0.15)")
      .attr("stroke", "#EF4444")
      .attr("stroke-width", 1)
      .attr("d", ddArea);

    // X axis at bottom of lower panel
    g2.append("g")
      .attr("transform", `translate(0,${botH - mb})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => d3.timeFormat("%b %y")(d as Date)),
      )
      .call((g) => {
        g.selectAll(".domain").attr("stroke", "#374151");
        g.selectAll(".tick line").remove();
        g.selectAll(".tick text").attr("fill", "#6B7280").attr("font-size", "10");
      });
  }, [points, height]);

  return (
    <svg
      ref={ref}
      width="100%"style={{ height }}
      className="block"/>
  );
}
