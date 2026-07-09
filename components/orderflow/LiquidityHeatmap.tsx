"use client";

import { useEffect, useRef } from "react";
import { computeHeatmapLayout, diffHeatmapCells, type HeatmapCell } from "@/lib/orderflow-data";

const COLUMN_WIDTH = 6;
const ROW_HEIGHT = 4;
const LABEL_GUTTER = 70;
const MAX_COLUMNS = 300;

interface LiquidityHeatmapProps {
  cells: HeatmapCell[];
}

export function LiquidityHeatmap({ cells }: LiquidityHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevCellsRef = useRef<HeatmapCell[]>([]);
  const prevLayoutRef = useRef<{ buckets: number[]; prices: number[] }>({ buckets: [], prices: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fullLayout = computeHeatmapLayout(cells);
    const buckets = fullLayout.buckets.slice(-MAX_COLUMNS);
    const layout = { buckets, prices: fullLayout.prices };
    const visibleCells = cells.filter((c) => buckets.includes(c.ts));

    const prevLayout = prevLayoutRef.current;
    const layoutChanged =
      layout.buckets.length !== prevLayout.buckets.length ||
      layout.prices.length !== prevLayout.prices.length ||
      layout.buckets.some((b, i) => b !== prevLayout.buckets[i]) ||
      layout.prices.some((p, i) => p !== prevLayout.prices[i]) ||
      visibleCells.length !== prevCellsRef.current.length;

    const width = LABEL_GUTTER + layout.buckets.length * COLUMN_WIDTH;
    const height = layout.prices.length * ROW_HEIGHT;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    function cellPos(ts: number, price: number): { x: number; y: number } | null {
      const col = layout.buckets.indexOf(ts);
      const row = layout.prices.indexOf(price);
      if (col === -1 || row === -1) return null;
      return { x: LABEL_GUTTER + col * COLUMN_WIDTH, y: row * ROW_HEIGHT };
    }

    const maxSize = Math.max(1, ...visibleCells.map((c) => c.size));

    function drawCell(cell: HeatmapCell) {
      const pos = cellPos(cell.ts, cell.price);
      if (!pos || !ctx) return;
      const intensity = Math.min(1, cell.size / maxSize);
      ctx.fillStyle = `rgba(255, 159, 10, ${0.1 + intensity * 0.8})`;
      ctx.fillRect(pos.x, pos.y, COLUMN_WIDTH, ROW_HEIGHT);
    }

    if (layoutChanged) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, LABEL_GUTTER, height);
      ctx.fillStyle = "#A8A8A8";
      ctx.font = "10px monospace";
      layout.prices.forEach((price, row) => {
        if (row % 5 === 0 && ctx) ctx.fillText(price.toFixed(2), 4, row * ROW_HEIGHT + ROW_HEIGHT);
      });
      for (const cell of visibleCells) drawCell(cell);
    } else {
      for (const cell of diffHeatmapCells(prevCellsRef.current, visibleCells)) drawCell(cell);
    }

    prevCellsRef.current = visibleCells;
    prevLayoutRef.current = layout;
  }, [cells]);

  return (
    <div className="border border-border bg-panel overflow-auto">
      <canvas ref={canvasRef} />
    </div>
  );
}
