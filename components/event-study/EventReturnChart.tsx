"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { EventStudyResult } from "@/lib/event-study-utils";

interface EventReturnChartProps {
  result: EventStudyResult;
  width?: number;
  height?: number;
}

const MARGIN = { top: 16, right: 24, bottom: 32, left: 52 };

export function EventReturnChart({ result, width = 800, height = 320 }: EventReturnChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const svg = d3.select(el);
    svg.selectAll("*").remove();

    const { windows, stats, dayLabels } = result;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    // Gather all finite return values for domain
    const allVals: number[] = [];
    windows.forEach(w => w.returns.forEach(v => { if (v !== null) allVals.push(v * 100); }));
    stats.avgReturns.forEach(v => { if (v !== null) allVals.push(v * 100); });
    if (allVals.length === 0) return;

    const yMin = Math.min(...allVals);
    const yMax = Math.max(...allVals);
    const yPad = Math.max(Math.abs(yMax - yMin) * 0.1, 0.5);

    const xScale = d3.scalePoint<string>().domain(dayLabels).range([0, innerW]).padding(0.3);
    const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([innerH, 0]);

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => ""),
      )
      .call(gg => gg.select(".domain").remove())
      .call(gg => gg.selectAll("line").attr("stroke", "#1E2530").attr("stroke-dasharray", "3,3"));

    // Zero line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(0)).attr("y2", yScale(0))
      .attr("stroke", "#374151").attr("stroke-width", 1);

    // Event day vertical marker
    const zeroX = xScale("0") ?? innerW / 2;
    g.append("line")
      .attr("x1", zeroX).attr("x2", zeroX)
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "#FF9F1C").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");

    // Line generator
    type Datum = { label: string; val: number | null };
    const lineGen = d3.line<Datum>()
      .defined(d => d.val !== null)
      .x(d => xScale(d.label) ?? 0)
      .y(d => yScale((d.val ?? 0) * 100));

    // Individual event lines (thin, low opacity)
    windows.forEach(w => {
      const data: Datum[] = dayLabels.map((label, i) => ({ label, val: w.returns[i] }));
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#6B7280")
        .attr("stroke-width", 0.8)
        .attr("stroke-opacity", 0.35)
        .attr("d", d => lineGen(d) ?? "");
    });

    // Avg line (orange)
    const avgData: Datum[] = dayLabels.map((label, i) => ({ label, val: stats.avgReturns[i] }));
    g.append("path")
      .datum(avgData)
      .attr("fill", "none")
      .attr("stroke", "#FF9F1C")
      .attr("stroke-width", 2.5)
      .attr("d", d => lineGen(d) ?? "");

    // Median line (blue, dashed)
    const medData: Datum[] = dayLabels.map((label, i) => ({ label, val: stats.medianReturns[i] }));
    g.append("path")
      .datum(medData)
      .attr("fill", "none")
      .attr("stroke", "#3B82F6")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,3")
      .attr("d", d => lineGen(d) ?? "");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale))
      .call(gg => gg.select(".domain").attr("stroke", "#374151"))
      .call(gg => gg.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10px"))
      .call(gg => gg.selectAll("line").attr("stroke", "#374151"));

    // Y axis (percentage)
    g.append("g")
      .call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat(v => `${(v as number).toFixed(1)}%`),
      )
      .call(gg => gg.select(".domain").attr("stroke", "#374151"))
      .call(gg => gg.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10px"))
      .call(gg => gg.selectAll("line").attr("stroke", "#374151"));

    // X axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 28)
      .attr("text-anchor", "middle")
      .attr("fill", "#6B7280")
      .attr("font-size", "10px")
      .text("Days from event");

  }, [result, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    />
  );
}
