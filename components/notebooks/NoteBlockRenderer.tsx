"use client";

import { useEffect, useRef } from "react";
import { createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { NotebookEntry, ChartBlock } from "@/lib/notebook-storage";
import { TOKEN } from "@/lib/chart-colors";

interface NoteBlockRendererProps {
  entry: NotebookEntry;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function ChartBlockView({ block }: { block: ChartBlock }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || block.data.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 180,
      layout: {
        background: { color: TOKEN.panel2 },
        textColor: TOKEN.text3,
      },
      grid: {
        vertLines: { color: TOKEN.border },
        horzLines: { color: TOKEN.border },
      },
      timeScale: { borderColor: TOKEN.border },
    });

    const series = chart.addSeries(LineSeries, { color: TOKEN.accent, lineWidth: 2 });
    series.setData(
      block.data.map(d => ({
        time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp,
        value: d.value,
      }))
    );
    chart.timeScale().fitContent();

    return () => { chart.remove(); };
  }, [block.data]);

  return (
    <div>
      {block.title && <div className="text-text-3 text-xs mb-2">{block.title}</div>}
      {block.data.length === 0 ? (
        <div className="h-[180px] bg-panel-2 rounded flex items-center justify-center text-text-3 text-xs">
          No data
        </div>
      ) : (
        <div ref={containerRef} className="w-full rounded overflow-hidden" />
      )}
    </div>
  );
}

export function NoteBlockRenderer({
  entry, onEdit, onDelete, onMoveUp, onMoveDown,
}: NoteBlockRendererProps) {
  const { block } = entry;
  const hasControls = onEdit || onDelete || onMoveUp || onMoveDown;

  function renderBlock() {
    switch (block.type) {
      case "comment":
        return (
          <pre className="text-text-2 text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {block.markdown}
          </pre>
        );

      case "metric":
        return (
          <div className="flex items-baseline gap-2">
            <span className="text-text-1 text-3xl font-data font-semibold">
              {block.value !== null ? block.value.toFixed(2) : "—"}
            </span>
            {block.unit && (
              <span className="text-text-3 text-sm">{block.unit}</span>
            )}
            <span className="text-text-3 text-sm ml-auto">{block.label}</span>
          </div>
        );

      case "table":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              {block.headers.length > 0 && (
                <thead>
                  <tr className="border-b border-border">
                    {block.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-text-3 font-normal uppercase tracking-wider text-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/40">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-text-2 font-data">
                        {cell !== null ? String(cell) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "chart":
        return <ChartBlockView block={block} />;

      case "image":
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.src}
            alt={block.alt || "notebook image"}
            className="max-w-full h-auto rounded border border-border"/>
        );
    }
  }

  return (
    <div className="group bg-panel border border-border rounded-lg p-4 relative">
      {hasControls && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveUp && (
            <button onClick={onMoveUp} className="text-[10px] px-1.5 h-5 bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
              ↑
            </button>
          )}
          {onMoveDown && (
            <button onClick={onMoveDown} className="text-[10px] px-1.5 h-5 bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
              ↓
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-[10px] px-1.5 h-5 bg-panel-2 border border-border rounded text-text-3 hover:text-text-1 cursor-pointer transition-colors">
              Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-[10px] px-1.5 h-5 bg-transparent border-0 text-text-3 hover:text-neg cursor-pointer transition-colors">
              ×
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] px-2 py-0.5 bg-panel-2 border border-border rounded text-text-3 uppercase tracking-wider">
          {block.type}
        </span>
      </div>

      {renderBlock()}
    </div>
  );
}
