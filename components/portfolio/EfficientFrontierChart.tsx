"use client";

import { useRef, useEffect } from "react";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { axisBottom, axisLeft } from "d3-axis";
import type { FrontierPoint, PortfolioWeights } from "@/lib/api";

interface EfficientFrontierChartProps {
  frontier: FrontierPoint[];
  minVariance: PortfolioWeights;
  maxSharpe: PortfolioWeights;
  width?: number;
  height?: number;
}

const MARGIN = { top: 20, right: 24, bottom: 40, left: 52 };

export function EfficientFrontierChart({
  frontier,
  minVariance,
  maxSharpe,
  width = 560,
  height = 320,
}: EfficientFrontierChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || frontier.length === 0) return;
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const allVols = [
      ...frontier.map((p) => p.volatility),
      minVariance.volatility,
      maxSharpe.volatility,
    ];
    const allRets = [
      ...frontier.map((p) => p.expected_return),
      minVariance.expected_return,
      maxSharpe.expected_return,
    ];
    const xMin = Math.min(...allVols);
    const xMax = Math.max(...allVols);
    const yMin = Math.min(...allRets);
    const yMax = Math.max(...allRets);
    const xPad = (xMax - xMin) * 0.1 || 0.01;
    const yPad = (yMax - yMin) * 0.1 || 0.01;

    const xScale = scaleLinear()
      .domain([xMin - xPad, xMax + xPad])
      .range([0, innerW]);
    const yScale = scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([innerH, 0]);

    // Grid lines — x
    g.selectAll(".gx")
      .data(xScale.ticks(5))
      .enter()
      .append("line")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#1E2530")
      .attr("stroke-width", 1);

    // Grid lines — y
    g.selectAll(".gy")
      .data(yScale.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "#1E2530")
      .attr("stroke-width", 1);

    // Efficient frontier line
    const lineGen = line<FrontierPoint>()
      .x((d) => xScale(d.volatility))
      .y((d) => yScale(d.expected_return));

    g.append("path")
      .datum(frontier)
      .attr("fill", "none")
      .attr("stroke", "#6B7280")
      .attr("stroke-width", 1.5)
      .attr("d", lineGen);

    // Min-variance point (blue circle)
    g.append("circle")
      .attr("cx", xScale(minVariance.volatility))
      .attr("cy", yScale(minVariance.expected_return))
      .attr("r", 6)
      .attr("fill", "#3B82F6");

    // Max-sharpe point (orange diamond)
    g.append("path")
      .attr("d", "M0,-7 L7,0 L0,7 L-7,0 Z")
      .attr(
        "transform",
        `translate(${xScale(maxSharpe.volatility)},${yScale(maxSharpe.expected_return)})`
      )
      .attr("fill", "#FF9F1C");

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => `${((+d) * 100).toFixed(1)}%`)
      )
      .call((ax) => ax.select(".domain").attr("stroke", "#374151"))
      .call((ax) => ax.selectAll(".tick line").attr("stroke", "#374151"))
      .call((ax) =>
        ax.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10")
      );

    // Y axis
    g.append("g")
      .call(
        axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${((+d) * 100).toFixed(1)}%`)
      )
      .call((ax) => ax.select(".domain").attr("stroke", "#374151"))
      .call((ax) => ax.selectAll(".tick line").attr("stroke", "#374151"))
      .call((ax) =>
        ax.selectAll("text").attr("fill", "#6B7280").attr("font-size", "10")
      );

    // X axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 35)
      .attr("text-anchor", "middle")
      .attr("fill", "#6B7280")
      .attr("font-size", "11")
      .text("Volatility (annualized)");

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -42)
      .attr("text-anchor", "middle")
      .attr("fill", "#6B7280")
      .attr("font-size", "11")
      .text("Expected Return");
  }, [frontier, minVariance, maxSharpe, width, height]);

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-lg"
      />
      <div className="flex gap-4 justify-center text-xs text-text-3 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-info inline-block shrink-0" />
          Min Variance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rotate-45 bg-accent inline-block shrink-0" />
          Max Sharpe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-[#6B7280] inline-block shrink-0" />
          Efficient Frontier
        </span>
      </div>
    </div>
  );
}
