"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { CorrelationPair } from "@/lib/api";

interface CorrelationNetworkProps {
  pairs: CorrelationPair[];
  threshold: number;
  width?: number;
  height?: number;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  correlation: number;
}

function nodeColor(instrumentId: string): string {
  const venue = instrumentId.split(".").pop() ?? "";
  if (venue === "XKRX") return "#FF9F1C";
  if (venue === "NASDAQ" || venue === "NYSE") return "#3B82F6";
  return "#6B7280";
}

function edgeColor(correlation: number): string {
  return correlation >= 0 ? "#22C55E" : "#EF4444";
}

export function CorrelationNetwork({
  pairs,
  threshold,
  width = 900,
  height = 550,
}: CorrelationNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const filtered = pairs.filter(p => Math.abs(p.correlation) >= threshold);

    const instrumentSet = new Set<string>();
    filtered.forEach(p => {
      instrumentSet.add(p.a);
      instrumentSet.add(p.b);
    });

    const nodes: NetworkNode[] = Array.from(instrumentSet).map(id => ({ id }));
    const links: NetworkLink[] = filtered.map(p => ({
      source: p.a,
      target: p.b,
      correlation: p.correlation,
    }));

    if (nodes.length === 0) {
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", "13px")
        .text("No pairs above threshold — lower the threshold or add more instruments");
      return;
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id(d => d.id)
          .distance(130),
      )
      .force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(26));

    const linkGroup = svg.append("g").attr("class", "links");
    const linkEl = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => edgeColor(d.correlation))
      .attr("stroke-opacity", d => 0.3 + Math.abs(d.correlation) * 0.7)
      .attr("stroke-width", d => 1 + Math.abs(d.correlation) * 4);

    const linkLabelEl = svg
      .append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "9px")
      .attr("fill", "#6B7280")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .text(d => d.correlation.toFixed(2));

    const nodeEl = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 20)
      .attr("fill", d => nodeColor(d.id))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#0F131A")
      .attr("stroke-width", 2)
      .attr("cursor", "grab")
      .call(
        d3
          .drag<SVGCircleElement, NetworkNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    const labelEl = svg
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("fill", "#F9FAFB")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("pointer-events", "none")
      .text(d => d.id.split(".")[0]);

    simulation.on("tick", () => {
      linkEl
        .attr("x1", d => (d.source as NetworkNode).x ?? 0)
        .attr("y1", d => (d.source as NetworkNode).y ?? 0)
        .attr("x2", d => (d.target as NetworkNode).x ?? 0)
        .attr("y2", d => (d.target as NetworkNode).y ?? 0);

      linkLabelEl
        .attr(
          "x",
          d =>
            (((d.source as NetworkNode).x ?? 0) +
              ((d.target as NetworkNode).x ?? 0)) /
            2,
        )
        .attr(
          "y",
          d =>
            (((d.source as NetworkNode).y ?? 0) +
              ((d.target as NetworkNode).y ?? 0)) /
            2,
        );

      nodeEl.attr("cx", d => d.x ?? 0).attr("cy", d => d.y ?? 0);
      labelEl.attr("x", d => d.x ?? 0).attr("y", d => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [pairs, threshold, width, height]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg"
    />
  );
}
