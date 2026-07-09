// components/orderflow/FootprintChart.tsx
"use client";

import { useEffect, useRef } from "react";
import { computeFootprintLayout, diffFootprintCells, type FootprintCell } from "@/lib/orderflow-data";

const CELL_WIDTH = 60;
const CELL_HEIGHT = 24;
const LABEL_GUTTER = 70;

interface FootprintChartProps {
  cells: FootprintCell[];
}

export function FootprintChart({ cells }: FootprintChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevCellsRef = useRef<FootprintCell[]>([]);
  const prevLayoutRef = useRef<{ buckets: number[]; prices: number[] }>({ buckets: [], prices: [] });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const layout = computeFootprintLayout(cells);
    const prevLayout = prevLayoutRef.current;
    const layoutChanged =
      layout.buckets.length !== prevLayout.buckets.length ||
      layout.prices.length !== prevLayout.prices.length ||
      layout.buckets.some((b, i) => b !== prevLayout.buckets[i]) ||
      layout.prices.some((p, i) => p !== prevLayout.prices[i]) ||
      cells.length !== prevCellsRef.current.length;

    const width = LABEL_GUTTER + layout.buckets.length * CELL_WIDTH;
    const height = layout.prices.length * CELL_HEIGHT;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    function cellPos(bucketTs: number, price: number): { x: number; y: number } | null {
      const col = layout.buckets.indexOf(bucketTs);
      const row = layout.prices.indexOf(price);
      if (col === -1 || row === -1) return null;
      return { x: LABEL_GUTTER + col * CELL_WIDTH, y: row * CELL_HEIGHT };
    }

    function drawCell(cell: FootprintCell) {
      const pos = cellPos(cell.bucketTs, cell.price);
      if (!pos || !ctx) return;
      const total = cell.buyVol + cell.sellVol;
      const buyRatio = total > 0 ? cell.buyVol / total : 0;
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT);
      ctx.fillStyle =
        buyRatio >= 0.5
          ? `rgba(0, 217, 100, ${0.2 + buyRatio * 0.6})`
          : `rgba(255, 59, 48, ${0.2 + (1 - buyRatio) * 0.6})`;
      ctx.fillRect(pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT);
      ctx.strokeStyle = "#2A2A2A";
      ctx.strokeRect(pos.x, pos.y, CELL_WIDTH, CELL_HEIGHT);
      ctx.fillStyle = "#F2F2F2";
      ctx.font = "10px monospace";
      ctx.fillText(`${cell.buyVol.toFixed(1)}/${cell.sellVol.toFixed(1)}`, pos.x + 4, pos.y + CELL_HEIGHT / 2 + 3);
    }

    function drawPriceLabels() {
      if (!ctx) return;
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, LABEL_GUTTER, height);
      ctx.fillStyle = "#A8A8A8";
      ctx.font = "10px monospace";
      layout.prices.forEach((price, row) => {
        ctx.fillText(price.toFixed(2), 4, row * CELL_HEIGHT + CELL_HEIGHT / 2 + 3);
      });
    }

    if (layoutChanged) {
      ctx.clearRect(0, 0, width, height);
      drawPriceLabels();
      for (const cell of cells) drawCell(cell);
    } else {
      for (const cell of diffFootprintCells(prevCellsRef.current, cells)) drawCell(cell);
    }

    prevCellsRef.current = cells;
    prevLayoutRef.current = layout;
  }, [cells]);

  return (
    <div className="border border-border bg-panel overflow-auto">
      <canvas ref={canvasRef} />
    </div>
  );
}
